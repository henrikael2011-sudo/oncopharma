-- M24 — autocadastro do paciente por convite de uso único (link + QR emitidos pela equipe).
-- O paciente/cuidador preenche no navegador; o registro nasce 'pending_review' (pendente de conferência) e SÓ a equipe
-- confirma. Na confirmação a equipe informa o prontuário e o paciente (sintético) é criado a partir dos dados enviados,
-- sem redigitação. Dados pessoais e clínicos informados ficam cifrados em repouso (AES-256-GCM, CARE_ENCRYPTION_KEY);
-- o token nunca é guardado (apenas SHA-256). RLS por organização. Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS patient_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  token_sha256 bytea NOT NULL UNIQUE CHECK (octet_length(token_sha256) = 32),
  created_by_issuer text NOT NULL, created_by_sub text NOT NULL,
  created_by_role text NOT NULL CHECK (created_by_role IN ('pharmacist','nurse','physician')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  synthetic boolean NOT NULL DEFAULT true,
  CONSTRAINT invite_max_7d CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days'),
  CONSTRAINT invite_used_or_revoked CHECK (used_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX IF NOT EXISTS patient_registration_invites_org_idx ON patient_registration_invites(organization_id, created_at DESC);
CREATE TABLE IF NOT EXISTS patient_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  invite_id uuid NOT NULL UNIQUE REFERENCES patient_registration_invites(id), -- uso único também no banco
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  payload_encrypted bytea NOT NULL, payload_iv bytea NOT NULL CHECK (octet_length(payload_iv) = 12), payload_tag bytea NOT NULL CHECK (octet_length(payload_tag) = 16),
  key_id text NOT NULL,
  submitted_by text NOT NULL CHECK (submitted_by IN ('patient','caregiver')),
  consent_terms_version text NOT NULL CHECK (char_length(consent_terms_version) BETWEEN 1 AND 40),
  consent_accepted_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','rejected')),
  patient_id uuid REFERENCES patients(id),
  reviewed_by_issuer text, reviewed_by_sub text, reviewed_by_role text, reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_reviewed_pair CHECK ((status = 'pending_review') = (reviewed_at IS NULL) AND (reviewed_at IS NULL) = (reviewed_by_sub IS NULL)),
  CONSTRAINT registration_confirmed_patient CHECK ((status = 'confirmed') = (patient_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS patient_registrations_status_idx ON patient_registrations(organization_id, status, created_at);
ALTER TABLE patient_registration_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_registration_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE patient_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_registrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reg_invites_read ON patient_registration_invites;
CREATE POLICY reg_invites_read ON patient_registration_invites FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS reg_invites_insert ON patient_registration_invites;
CREATE POLICY reg_invites_insert ON patient_registration_invites FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true AND used_at IS NULL AND revoked_at IS NULL);
DROP POLICY IF EXISTS reg_invites_update ON patient_registration_invites;
CREATE POLICY reg_invites_update ON patient_registration_invites FOR UPDATE USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS reg_read ON patient_registrations;
CREATE POLICY reg_read ON patient_registrations FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
DROP POLICY IF EXISTS reg_insert ON patient_registrations;
CREATE POLICY reg_insert ON patient_registrations FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true AND status = 'pending_review' AND patient_id IS NULL AND reviewed_at IS NULL);
DROP POLICY IF EXISTS reg_update ON patient_registrations;
CREATE POLICY reg_update ON patient_registrations FOR UPDATE USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT, INSERT ON patient_registration_invites TO oncopharma_app;
GRANT UPDATE (used_at, revoked_at) ON patient_registration_invites TO oncopharma_app; -- token, prazo e autoria imutáveis
GRANT SELECT, INSERT ON patient_registrations TO oncopharma_app;
GRANT UPDATE (status, patient_id, reviewed_by_issuer, reviewed_by_sub, reviewed_by_role, reviewed_at, review_note) ON patient_registrations TO oncopharma_app; -- dados enviados imutáveis
COMMIT;
