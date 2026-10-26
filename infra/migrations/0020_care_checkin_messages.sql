-- M25 — Care: check-in diário (um por paciente/dia, editável no mesmo dia) e mensagens paciente/cuidador <-> equipe.
-- Texto livre cifrado em repouso (AES-256-GCM, CARE_ENCRYPTION_KEY, mesmo esquema de 0016); RLS por organização; somente dados sintéticos.
-- Temperatura do check-in reaproveita patient_temperature_readings (regra de febre 37,8 °C e alerta pelo caminho existente).
-- Mensagens NÃO são canal de urgência (aviso na tela + 192 SAMU). Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS patient_daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  checkin_date date NOT NULL,
  feeling text NOT NULL CHECK (feeling IN ('bem','mais_ou_menos','mal')),
  note_encrypted bytea, note_iv bytea CHECK (note_iv IS NULL OR octet_length(note_iv) = 12), note_tag bytea CHECK (note_tag IS NULL OR octet_length(note_tag) = 16), key_id text,
  temperature_reading_id uuid REFERENCES patient_temperature_readings(id),
  symptom_report_id uuid REFERENCES patient_symptom_reports(id),
  recorded_by text NOT NULL CHECK (recorded_by IN ('patient','caregiver')),
  actor_issuer text NOT NULL, actor_sub text NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edit_count int NOT NULL DEFAULT 0 CHECK (edit_count >= 0 AND edit_count <= 20),
  UNIQUE (organization_id, patient_id, checkin_date),
  CONSTRAINT checkin_note_sealed CHECK ((note_encrypted IS NULL) = (note_iv IS NULL) AND (note_iv IS NULL) = (note_tag IS NULL))
);
CREATE INDEX IF NOT EXISTS patient_daily_checkins_patient_idx ON patient_daily_checkins(organization_id, patient_id, checkin_date DESC);
ALTER TABLE patient_daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_daily_checkins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkins_tenant_read ON patient_daily_checkins;
CREATE POLICY checkins_tenant_read ON patient_daily_checkins FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS checkins_tenant_insert ON patient_daily_checkins;
CREATE POLICY checkins_tenant_insert ON patient_daily_checkins FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true);
DROP POLICY IF EXISTS checkins_tenant_update ON patient_daily_checkins;
-- Edição somente no mesmo dia do check-in (o banco garante; a API recusa antes).
CREATE POLICY checkins_tenant_update ON patient_daily_checkins FOR UPDATE
  USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND checkin_date = current_date)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND checkin_date = current_date);
GRANT SELECT, INSERT ON patient_daily_checkins TO oncopharma_app;
GRANT UPDATE (feeling, note_encrypted, note_iv, note_tag, key_id, temperature_reading_id, symptom_report_id, recorded_by, actor_issuer, actor_sub, updated_at, edit_count) ON patient_daily_checkins TO oncopharma_app;

CREATE TABLE IF NOT EXISTS care_team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  direction text NOT NULL CHECK (direction IN ('to_team','to_patient')),
  author_role text NOT NULL CHECK (author_role IN ('patient','caregiver','pharmacist','physician','nurse','clinical_manager')),
  author_display text,
  actor_issuer text NOT NULL, actor_sub text NOT NULL,
  topic text NOT NULL DEFAULT 'geral' CHECK (topic IN ('geral','remedios','consulta','outro')),
  body_encrypted bytea NOT NULL, body_iv bytea NOT NULL CHECK (octet_length(body_iv) = 12), body_tag bytea NOT NULL CHECK (octet_length(body_tag) = 16), key_id text NOT NULL,
  source_reference text NOT NULL,
  read_at timestamptz,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_reference),
  CONSTRAINT message_author_direction CHECK ((direction = 'to_team') = (author_role IN ('patient','caregiver')))
);
CREATE INDEX IF NOT EXISTS care_team_messages_patient_idx ON care_team_messages(organization_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_team_messages_unread_idx ON care_team_messages(organization_id, direction) WHERE read_at IS NULL;
ALTER TABLE care_team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_team_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_tenant_read ON care_team_messages;
CREATE POLICY messages_tenant_read ON care_team_messages FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS messages_tenant_insert ON care_team_messages;
CREATE POLICY messages_tenant_insert ON care_team_messages FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true);
DROP POLICY IF EXISTS messages_tenant_update ON care_team_messages;
CREATE POLICY messages_tenant_update ON care_team_messages FOR UPDATE USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT, INSERT ON care_team_messages TO oncopharma_app;
GRANT UPDATE (read_at) ON care_team_messages TO oncopharma_app; -- texto e autoria imutáveis; sem DELETE
COMMIT;
