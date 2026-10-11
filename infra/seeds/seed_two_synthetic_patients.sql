-- SOMENTE DESENVOLVIMENTO. Pacientes inteiramente sintéticos, sem dados pessoais.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Seed somente no banco oncopharma_dev'; END IF; END $$;
INSERT INTO organizations(id, name) VALUES ('11111111-1111-4111-8111-111111111111','ONCOPHARMA LAB (SINTÉTICO)') ON CONFLICT(id) DO NOTHING;
-- FORCE RLS exige contexto de tenant até para inserção/consulta quando o role está sujeito à política.
SELECT set_config('app.organization_id','11111111-1111-4111-8111-111111111111',true);
-- Seed executado exclusivamente pelo proprietário das tabelas, em DEV.
-- Desativa FORCE apenas nesta transação e restaura antes do COMMIT.
ALTER TABLE patients NO FORCE ROW LEVEL SECURITY;
ALTER TABLE care_assignments NO FORCE ROW LEVEL SECURITY;
INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES
 ('22222222-2222-4222-8222-222222222221','11111111-1111-4111-8111-111111111111','TESTE-FOLFOX-001',true),
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','TESTE-ACT-002',true)
ON CONFLICT(id) DO NOTHING;
INSERT INTO memberships(organization_id,oidc_issuer,oidc_sub,role)
VALUES('11111111-1111-4111-8111-111111111111', :'oidc_issuer', :'oidc_sub','pharmacist') ON CONFLICT DO NOTHING;
INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221', :'oidc_issuer', :'oidc_sub'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222', :'oidc_issuer', :'oidc_sub')
ON CONFLICT DO NOTHING;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
ALTER TABLE care_assignments FORCE ROW LEVEL SECURITY;
COMMIT;
