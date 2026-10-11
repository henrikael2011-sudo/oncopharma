-- M14.5 — vínculos de identidades SINTÉTICAS do IdP de teste. Somente oncopharma_dev. Executar com role administrativa.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
INSERT INTO memberships(organization_id,oidc_issuer,oidc_sub,role) VALUES
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_nurse', 'nurse'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_physician', 'physician'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_admin', 'technical_admin'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_pharm_nomfa', 'pharmacist'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_patient_a', 'patient'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_patient_b', 'patient'),
 ('11111111-1111-4111-8111-111111111111', :'iss', :'sub_caregiver', 'caregiver')
ON CONFLICT DO NOTHING;
-- Enfermeira e médico atribuídos somente ao paciente A (teste negativo de vínculo assistencial para B).
INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221', :'iss', :'sub_nurse'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221', :'iss', :'sub_physician'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221', :'iss', :'sub_pharm_nomfa'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222', :'iss', :'sub_pharm_nomfa')
ON CONFLICT DO NOTHING;
INSERT INTO patient_portal_links(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221', :'iss', :'sub_patient_a'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222', :'iss', :'sub_patient_b')
ON CONFLICT DO NOTHING;
COMMIT;
