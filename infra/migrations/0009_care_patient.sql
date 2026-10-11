-- M15.2 — ONCOPHARMA Care (paciente): consentimento, preferências de acessibilidade, adesão relatada,
-- sintoma estruturado e contatos de ajuda configuráveis. Somente DEV; executar com role administrativa.
-- R3: o paciente é resolvido pela identidade (patient_portal_links), nunca por identificador digitado.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS patient_care_preferences (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  font_scale text NOT NULL DEFAULT 'normal' CHECK (font_scale IN ('normal','large','xlarge')),
  high_contrast boolean NOT NULL DEFAULT false,
  consent_terms_version text,
  consent_accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, patient_id),
  CONSTRAINT consent_pair CHECK ((consent_terms_version IS NULL) = (consent_accepted_at IS NULL))
);
CREATE TABLE IF NOT EXISTS patient_adherence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  order_id uuid NOT NULL REFERENCES clinical_medication_orders(id),
  status text NOT NULL CHECK (status IN ('taken','missed','partial')),
  reported_on date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'care-portal',
  source_reference text NOT NULL,
  actor_issuer text NOT NULL,
  actor_sub text NOT NULL,
  synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_reference)
);
CREATE INDEX IF NOT EXISTS patient_adherence_reports_patient_idx ON patient_adherence_reports(patient_id);
CREATE TABLE IF NOT EXISTS organization_help_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  label text NOT NULL, phone text, hours text, sort_order int NOT NULL DEFAULT 0
);
-- Sintoma estruturado (questionário demonstrativo; conteúdo clínico pendente de validação institucional).
ALTER TABLE patient_symptom_reports ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE patient_symptom_reports ADD COLUMN IF NOT EXISTS actor_issuer text;
ALTER TABLE patient_symptom_reports ADD COLUMN IF NOT EXISTS actor_sub text;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['patient_care_preferences','patient_adherence_reports','organization_help_contacts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)', t||'_tenant_read', t);
    EXECUTE format('GRANT SELECT ON %I TO oncopharma_app', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS prefs_insert_tenant ON patient_care_preferences;
CREATE POLICY prefs_insert_tenant ON patient_care_preferences FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS prefs_update_tenant ON patient_care_preferences;
CREATE POLICY prefs_update_tenant ON patient_care_preferences FOR UPDATE
  USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT INSERT ON patient_care_preferences TO oncopharma_app;
GRANT UPDATE (font_scale, high_contrast, consent_terms_version, consent_accepted_at, updated_at) ON patient_care_preferences TO oncopharma_app;
DROP POLICY IF EXISTS adherence_insert_tenant ON patient_adherence_reports;
CREATE POLICY adherence_insert_tenant ON patient_adherence_reports FOR INSERT
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true);
GRANT INSERT ON patient_adherence_reports TO oncopharma_app;  -- sem UPDATE/DELETE: relato é imutável
-- Contatos de ajuda: somente leitura pela aplicação (configuração institucional; vazios em DEV).
COMMIT;
