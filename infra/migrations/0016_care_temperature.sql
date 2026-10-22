-- M21.2 — temperatura registrada no Care (paciente ou cuidador com permissão registrar_sintoma).
-- Valor cifrado em repouso (AES-256-GCM, chave de ambiente CARE_ENCRYPTION_KEY); RLS por organização; imutável.
-- Leitura >= 37,8 °C gera relato de febre + alerta pelo caminho existente (patient_symptom_reports/clinical_alerts).
-- Numeração 0016: 0015 pertence ao M20 (preparation_stability). Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS patient_temperature_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  value_encrypted bytea NOT NULL,
  value_iv bytea NOT NULL CHECK (octet_length(value_iv) = 12),
  value_tag bytea NOT NULL CHECK (octet_length(value_tag) = 16),
  key_id text NOT NULL,
  measured_at timestamptz NOT NULL,
  recorded_by text NOT NULL CHECK (recorded_by IN ('patient','caregiver')),
  actor_issuer text NOT NULL,
  actor_sub text NOT NULL,
  source_reference text NOT NULL,
  symptom_report_id uuid REFERENCES patient_symptom_reports(id),
  synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_reference)
);
CREATE INDEX IF NOT EXISTS patient_temperature_readings_patient_idx ON patient_temperature_readings(organization_id, patient_id, measured_at DESC);
ALTER TABLE patient_temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_temperature_readings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patient_temperature_readings_tenant_read ON patient_temperature_readings;
CREATE POLICY patient_temperature_readings_tenant_read ON patient_temperature_readings FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS temperature_insert_tenant ON patient_temperature_readings;
CREATE POLICY temperature_insert_tenant ON patient_temperature_readings FOR INSERT
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true);
GRANT SELECT, INSERT ON patient_temperature_readings TO oncopharma_app;  -- sem UPDATE/DELETE: leitura é imutável
COMMIT;
