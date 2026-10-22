-- M22 — transcrição da prescrição médica pela equipe + liberação farmacêutica antes de chegar ao paciente (Care).
-- Alterar a prescrição continua sendo do médico: aqui só se TRANSCREVE o que foi prescrito (com referência da prescrição)
-- e a farmácia confere e libera. Sem decisão automática/IA. Dose e orientações cifradas em repouso (AES-256-GCM,
-- CARE_ENCRYPTION_KEY). RLS por organização. Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS clinical_med_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  lineage_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  kind text NOT NULL CHECK (kind IN ('new','update','discontinue')),
  medication text NOT NULL CHECK (char_length(medication) BETWEEN 2 AND 120),
  dose_encrypted bytea NOT NULL, dose_iv bytea NOT NULL CHECK (octet_length(dose_iv)=12), dose_tag bytea NOT NULL CHECK (octet_length(dose_tag)=16),
  route text NOT NULL CHECK (route IN ('VO','SC-casa','SC','IV','IM','topica','outra')),
  times text[] NOT NULL CHECK (cardinality(times) BETWEEN 1 AND 8),
  frequency_text text NOT NULL CHECK (char_length(frequency_text) BETWEEN 2 AND 120),
  start_date date NOT NULL,
  end_date date CHECK (end_date IS NULL OR end_date >= start_date),
  instructions_encrypted bytea NOT NULL, instructions_iv bytea NOT NULL CHECK (octet_length(instructions_iv)=12), instructions_tag bytea NOT NULL CHECK (octet_length(instructions_tag)=16),
  key_id text NOT NULL,
  prescription_reference text NOT NULL CHECK (char_length(prescription_reference) BETWEEN 3 AND 160),
  status text NOT NULL CHECK (status IN ('pending_release','released','rejected','superseded','discontinued')),
  entered_by_issuer text NOT NULL, entered_by_sub text NOT NULL, entered_by_role text NOT NULL, entered_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_issuer text, reviewed_by_sub text, reviewed_at timestamptz, review_note text,
  order_id uuid REFERENCES clinical_medication_orders(id),
  synthetic boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, lineage_id, version),
  CONSTRAINT reviewed_pair CHECK ((reviewed_at IS NULL) = (reviewed_by_sub IS NULL))
);
CREATE INDEX IF NOT EXISTS clinical_med_transcriptions_patient_idx ON clinical_med_transcriptions(organization_id, patient_id);
CREATE INDEX IF NOT EXISTS clinical_med_transcriptions_order_idx ON clinical_med_transcriptions(order_id);
-- no máximo UMA pendência por linhagem
CREATE UNIQUE INDEX IF NOT EXISTS clinical_med_transcriptions_one_pending ON clinical_med_transcriptions(organization_id, lineage_id) WHERE status = 'pending_release';
ALTER TABLE clinical_med_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_med_transcriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS med_tr_read ON clinical_med_transcriptions;
CREATE POLICY med_tr_read ON clinical_med_transcriptions FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS med_tr_insert ON clinical_med_transcriptions;
CREATE POLICY med_tr_insert ON clinical_med_transcriptions FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true AND status = 'pending_release' AND reviewed_at IS NULL);
DROP POLICY IF EXISTS med_tr_update ON clinical_med_transcriptions;
CREATE POLICY med_tr_update ON clinical_med_transcriptions FOR UPDATE USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT, INSERT ON clinical_med_transcriptions TO oncopharma_app;
GRANT UPDATE (status, reviewed_by_issuer, reviewed_by_sub, reviewed_at, review_note, order_id) ON clinical_med_transcriptions TO oncopharma_app; -- conteúdo transcrito é imutável
-- Pedido ativo que o Care lê: criado/atualizado SOMENTE na liberação farmacêutica.
DROP POLICY IF EXISTS med_orders_insert_m22 ON clinical_medication_orders;
CREATE POLICY med_orders_insert_m22 ON clinical_medication_orders FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND source_reference LIKE 'transcr:%');
DROP POLICY IF EXISTS med_orders_update_m22 ON clinical_medication_orders;
CREATE POLICY med_orders_update_m22 ON clinical_medication_orders FOR UPDATE USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND source_reference LIKE 'transcr:%') WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND source_reference LIKE 'transcr:%');
GRANT INSERT ON clinical_medication_orders TO oncopharma_app;
GRANT UPDATE (medication, route, frequency_text, status) ON clinical_medication_orders TO oncopharma_app;
-- Adesão por dose agendada (HH:MM). NULL = relato do dia (comportamento anterior).
ALTER TABLE patient_adherence_reports ADD COLUMN IF NOT EXISTS scheduled_time text CHECK (scheduled_time IS NULL OR scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
COMMIT;
