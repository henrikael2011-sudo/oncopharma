-- M1: schema de identidade, escopo institucional e auditoria (base de desenvolvimento).
-- Executar somente depois de 0001_foundation.sql.
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  oidc_issuer text NOT NULL,
  oidc_sub text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient','caregiver','pharmacist','physician','nurse','clinical_manager','technical_admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, oidc_issuer, oidc_sub, role)
);
CREATE INDEX IF NOT EXISTS memberships_lookup ON memberships (oidc_issuer, oidc_sub, organization_id) WHERE active;
CREATE TABLE IF NOT EXISTS care_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  oidc_issuer text NOT NULL,
  oidc_sub text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, oidc_issuer, oidc_sub)
);
CREATE INDEX IF NOT EXISTS care_assignments_lookup ON care_assignments (oidc_issuer, oidc_sub, patient_id) WHERE active;
CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_issuer text NOT NULL,
  actor_sub text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_by_org_date ON audit_events (organization_id, created_at DESC);
-- Auditoria append-only no plano de aplicação; backups e trilha externa ainda pendentes.
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events é append-only'; END; $$;
DROP TRIGGER IF EXISTS audit_immutable ON audit_events;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
-- Row level security com FORCE impede que o proprietário da tabela contorne políticas.
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patients_tenant ON patients;
CREATE POLICY patients_tenant ON patients FOR SELECT USING (
  organization_id = nullif(current_setting('app.organization_id', true),'')::uuid
);
ALTER TABLE care_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assignments_tenant ON care_assignments;
CREATE POLICY assignments_tenant ON care_assignments FOR SELECT USING (
  organization_id = nullif(current_setting('app.organization_id', true),'')::uuid
);
-- Atribuições e pacientes somente por procedimentos administrativos controlados; sem endpoints de escrita.
