-- M15.4 — Clinical: identificação segura do paciente, máquina de estados de alerta (Plano v3 §5.1) com transições auditadas,
-- tarefas/encaminhamentos com confirmação de recebimento e parecer pré-ciclo persistido. Somente DEV; role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
-- 1) Identificação segura para lista/busca (nome + prontuário). Sem CPF/data de nascimento.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS display_name text CHECK (display_name IS NULL OR length(display_name) BETWEEN 2 AND 80);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS hospital_record text CHECK (hospital_record IS NULL OR hospital_record ~ '^[A-Za-z0-9-]{3,30}$');
CREATE UNIQUE INDEX IF NOT EXISTS patients_hospital_record ON patients(organization_id, hospital_record) WHERE hospital_record IS NOT NULL;

-- 2) Estados de alerta §5.1: Detectado → Aguardando revisão → Em avaliação → Encaminhado → Em acompanhamento → Resolvido;
--    Descartado (com justificativa) e Duplicado (vinculado). Sem fechamento por tempo (nenhum job altera estado).
ALTER TABLE clinical_alerts DROP CONSTRAINT IF EXISTS clinical_alerts_status_check;
UPDATE clinical_alerts SET status = CASE status WHEN 'open' THEN 'awaiting_review' WHEN 'acknowledged' THEN 'in_evaluation' ELSE status END;
ALTER TABLE clinical_alerts ALTER COLUMN status SET DEFAULT 'awaiting_review';
ALTER TABLE clinical_alerts ADD CONSTRAINT clinical_alerts_status_check CHECK (status IN ('detected','awaiting_review','in_evaluation','referred','monitoring','resolved','dismissed','duplicate'));
ALTER TABLE clinical_alerts ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES clinical_alerts(id);
ALTER TABLE clinical_alerts ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE clinical_alerts DROP CONSTRAINT IF EXISTS alert_duplicate_link;
ALTER TABLE clinical_alerts ADD CONSTRAINT alert_duplicate_link CHECK ((status = 'duplicate') = (duplicate_of IS NOT NULL) AND (duplicate_of IS NULL OR duplicate_of <> id));
CREATE OR REPLACE FUNCTION clinical_alert_transition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ok boolean;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  ok := CASE OLD.status
    WHEN 'detected' THEN NEW.status IN ('awaiting_review','dismissed','duplicate')
    WHEN 'awaiting_review' THEN NEW.status IN ('in_evaluation','dismissed','duplicate')
    WHEN 'in_evaluation' THEN NEW.status IN ('referred','monitoring','resolved','dismissed','duplicate')
    WHEN 'referred' THEN NEW.status IN ('in_evaluation','monitoring','resolved')
    WHEN 'monitoring' THEN NEW.status IN ('in_evaluation','referred','resolved')
    ELSE false END;  -- resolved/dismissed/duplicate são finais
  IF NOT ok THEN RAISE EXCEPTION 'Transição de alerta não permitida: % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM clinical_alert_transitions t WHERE t.alert_id = NEW.id AND t.from_status = OLD.status AND t.to_status = NEW.status AND t.at >= now() - interval '1 minute' AND t.applied = false) THEN
    RAISE EXCEPTION 'Transição sem registro de autoria' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE clinical_alert_transitions SET applied = true WHERE alert_id = NEW.id AND from_status = OLD.status AND to_status = NEW.status AND applied = false;
  NEW.status_changed_at := now();
  IF NEW.status = 'resolved' THEN NEW.resolved_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TABLE IF NOT EXISTS clinical_alert_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  alert_id uuid NOT NULL REFERENCES clinical_alerts(id),
  from_status text NOT NULL, to_status text NOT NULL,
  justification text CHECK (justification IS NULL OR length(justification) <= 2000),
  actor_issuer text NOT NULL, actor_sub text NOT NULL, actor_role text NOT NULL CHECK (actor_role IN ('pharmacist','physician','nurse','clinical_manager')),
  at timestamptz NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false,
  CONSTRAINT dismiss_needs_justification CHECK (to_status <> 'dismissed' OR length(trim(coalesce(justification,''))) >= 10)
);
DROP TRIGGER IF EXISTS clinical_alert_transition_guard ON clinical_alerts;
CREATE TRIGGER clinical_alert_transition_guard BEFORE UPDATE OF status ON clinical_alerts FOR EACH ROW EXECUTE FUNCTION clinical_alert_transition_guard();
REVOKE UPDATE ON clinical_alerts FROM oncopharma_app;
GRANT UPDATE (status, duplicate_of) ON clinical_alerts TO oncopharma_app;

-- 3) Tarefas e encaminhamentos com responsável, prazo, confirmação de recebimento e desfecho.
CREATE TABLE IF NOT EXISTS clinical_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  alert_id uuid REFERENCES clinical_alerts(id),
  kind text NOT NULL CHECK (kind IN ('task','referral')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  details text CHECK (details IS NULL OR length(details) <= 2000),
  assignee_role text NOT NULL CHECK (assignee_role IN ('pharmacist','physician','nurse','clinical_manager')),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','received','done','cancelled')),
  created_by_issuer text NOT NULL, created_by_sub text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  received_by_sub text, received_at timestamptz,
  closed_by_sub text, closed_at timestamptz,
  outcome text CHECK (outcome IS NULL OR length(outcome) <= 2000),
  CONSTRAINT task_received CHECK ((received_at IS NULL) = (received_by_sub IS NULL)),
  CONSTRAINT task_closed CHECK ((status IN ('done','cancelled')) = (closed_at IS NOT NULL) AND (status <> 'done' OR length(trim(coalesce(outcome,''))) >= 3))
);
CREATE OR REPLACE FUNCTION clinical_task_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('done','cancelled') THEN RAISE EXCEPTION 'Tarefa encerrada é imutável' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status = 'received' AND NEW.status = 'open' THEN RAISE EXCEPTION 'Recebimento não pode ser desfeito' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.received_at IS NOT NULL AND (NEW.received_at IS DISTINCT FROM OLD.received_at OR NEW.received_by_sub IS DISTINCT FROM OLD.received_by_sub) THEN
    RAISE EXCEPTION 'Recebimento já confirmado' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clinical_task_guard ON clinical_tasks;
CREATE TRIGGER clinical_task_guard BEFORE UPDATE ON clinical_tasks FOR EACH ROW EXECUTE FUNCTION clinical_task_guard();

-- 4) RLS por organização (nullif, 0008) e privilégios mínimos.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['clinical_alert_transitions','clinical_tasks'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant', t);
  EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t||'_tenant', t);
END LOOP; END $$;
GRANT SELECT, INSERT ON clinical_alert_transitions TO oncopharma_app;
GRANT UPDATE (applied) ON clinical_alert_transitions TO oncopharma_app;
GRANT SELECT, INSERT ON clinical_tasks TO oncopharma_app;
GRANT UPDATE (status, received_by_sub, received_at, closed_by_sub, closed_at, outcome) ON clinical_tasks TO oncopharma_app;
-- Parecer pré-ciclo (clinical_reviews existe desde 0006): inserção pela aplicação, sem UPDATE/DELETE (parecer novo substitui).
DROP POLICY IF EXISTS review_insert_tenant ON clinical_reviews;
CREATE POLICY review_insert_tenant ON clinical_reviews FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
GRANT INSERT ON clinical_reviews TO oncopharma_app;
COMMIT;
-- 5) Alerta novo nasce em "Detectado" ou "Aguardando revisão"; estados posteriores só por transição registrada.
BEGIN;
CREATE OR REPLACE FUNCTION clinical_alert_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('detected','awaiting_review') THEN RAISE EXCEPTION 'Alerta novo deve iniciar em detected/awaiting_review' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clinical_alert_insert_guard ON clinical_alerts;
CREATE TRIGGER clinical_alert_insert_guard BEFORE INSERT ON clinical_alerts FOR EACH ROW EXECUTE FUNCTION clinical_alert_insert_guard();
COMMIT;
