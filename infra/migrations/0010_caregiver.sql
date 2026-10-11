-- M15.3 — Cuidador (R4 / P-R4): convite do paciente (código de uso único, 72 h), vínculo com escopos desligados por padrão,
-- prazo máximo de 90 dias, revogação imediata e histórico de acessos. Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
ALTER TABLE patient_care_preferences ADD COLUMN IF NOT EXISTS display_name text CHECK (display_name IS NULL OR length(display_name) <= 60);
GRANT UPDATE (display_name) ON patient_care_preferences TO oncopharma_app;
CREATE TABLE IF NOT EXISTS caregiver_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256; o código nunca é armazenado
  term_days int NOT NULL CHECK (term_days BETWEEN 1 AND 90),
  created_by_issuer text NOT NULL, created_by_sub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz, used_by_issuer text, used_by_sub text,
  cancelled_at timestamptz,
  CONSTRAINT invite_72h CHECK (expires_at <= created_at + interval '72 hours'),
  CONSTRAINT invite_use CHECK ((used_at IS NULL) = (used_by_sub IS NULL))
);
CREATE TABLE IF NOT EXISTS caregiver_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  invite_id uuid NOT NULL UNIQUE REFERENCES caregiver_invites(id),
  caregiver_issuer text NOT NULL, caregiver_sub text NOT NULL,
  caregiver_display_name text CHECK (caregiver_display_name IS NULL OR length(caregiver_display_name) <= 60),
  scopes text[] NOT NULL DEFAULT '{}' CHECK (scopes <@ ARRAY['ver_jornada','ver_medicamentos','registrar_sintoma']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  consent_accepted_at timestamptz NOT NULL,
  CONSTRAINT link_90d CHECK (expires_at <= created_at + interval '90 days')
);
-- Histórico de acessos do cuidador visível ao paciente (sem conceder leitura de audit_events à aplicação).
CREATE TABLE IF NOT EXISTS caregiver_access_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  link_id uuid NOT NULL REFERENCES caregiver_links(id),
  action text NOT NULL CHECK (action ~ '^care\.[a-z.]+$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS caregiver_access_events_patient_idx ON caregiver_access_events(patient_id, at DESC);
CREATE INDEX IF NOT EXISTS caregiver_links_sub_idx ON caregiver_links(organization_id, caregiver_issuer, caregiver_sub);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['caregiver_invites','caregiver_links','caregiver_access_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)', t||'_tenant_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)', t||'_tenant_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)', t||'_tenant_update', t);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO oncopharma_app', t);
  END LOOP;
END $$;
REVOKE UPDATE ON caregiver_access_events FROM oncopharma_app;
GRANT USAGE ON SEQUENCE caregiver_access_events_id_seq TO oncopharma_app;
-- Somente colunas de ciclo de vida são atualizáveis; sem DELETE (histórico preservado).
GRANT UPDATE (used_at, used_by_issuer, used_by_sub, cancelled_at) ON caregiver_invites TO oncopharma_app;
GRANT UPDATE (scopes, revoked_at) ON caregiver_links TO oncopharma_app;
-- Revogação é definitiva: um vínculo revogado não pode ser reativado nem ter escopos alterados.
CREATE OR REPLACE FUNCTION caregiver_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Vínculo de cuidador revogado é imutável' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS caregiver_link_guard ON caregiver_links;
CREATE TRIGGER caregiver_link_guard BEFORE UPDATE ON caregiver_links FOR EACH ROW EXECUTE FUNCTION caregiver_link_guard();
COMMIT;
