-- M15.2 — dados exclusivamente sintéticos para o Care (histórico de ciclos, medicamento oral, orientação aprovada).
-- Somente oncopharma_dev. Executar com role administrativa após seed_m2_*.sql.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
ALTER TABLE treatment_cycles NO FORCE ROW LEVEL SECURITY; ALTER TABLE clinical_medication_orders NO FORCE ROW LEVEL SECURITY; ALTER TABLE patient_guidance NO FORCE ROW LEVEL SECURITY;
INSERT INTO treatment_cycles(id,organization_id,patient_id,protocol_id,cycle_number,planned_on,status) VALUES
 ('44444444-4444-4444-8444-444444444451','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','33333333-3333-4333-8333-333333333331',1,'2026-09-04','completed'),
 ('44444444-4444-4444-8444-444444444452','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','33333333-3333-4333-8333-333333333331',2,'2026-09-18','completed'),
 ('44444444-4444-4444-8444-444444444453','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333332',1,'2026-09-21','completed')
ON CONFLICT DO NOTHING;
INSERT INTO clinical_medication_orders(id,organization_id,patient_id,medication,dose_value,dose_unit,route,frequency_text,status,ordered_at,source_reference) VALUES
 ('66666666-6666-4666-8666-666666666671','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Ondansetrona (comprimido)',8,'mg','VO','Se tiver enjoo, conforme orientação da equipe','active','2026-10-09 10:00+00','SIM-RX-CARE-001'),
 ('66666666-6666-4666-8666-666666666672','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Dexametasona (comprimido)',4,'mg','VO','Pela manhã, nos dias indicados pela equipe','active','2026-10-09 10:00+00','SIM-RX-CARE-002')
ON CONFLICT DO NOTHING;
UPDATE clinical_medication_orders SET frequency_text='Aplicado no hospital, durante a sessão' WHERE source_reference IN ('SIM-RX-001','SIM-RX-002') AND organization_id='11111111-1111-4111-8111-111111111111';
INSERT INTO patient_guidance(id,organization_id,patient_id,body,status,approved_by,approved_at) VALUES
 ('77777777-7777-4777-8777-777777777771','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Evite bebidas e alimentos muito gelados nos dias seguintes à sessão.','approved','equipe-sintetica','2026-10-09 18:00+00'),
 ('77777777-7777-4777-8777-777777777772','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Rascunho não aprovado — não deve aparecer no Care.','draft',NULL,NULL)
ON CONFLICT DO NOTHING;
ALTER TABLE treatment_cycles FORCE ROW LEVEL SECURITY; ALTER TABLE clinical_medication_orders FORCE ROW LEVEL SECURITY; ALTER TABLE patient_guidance FORCE ROW LEVEL SECURITY;
-- Reinicia consentimento/preferências e adesão dos pacientes sintéticos (cada execução E2E começa do primeiro acesso).
ALTER TABLE patient_care_preferences NO FORCE ROW LEVEL SECURITY;
DELETE FROM patient_care_preferences WHERE organization_id='11111111-1111-4111-8111-111111111111' AND patient_id IN ('22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222');
ALTER TABLE patient_care_preferences FORCE ROW LEVEL SECURITY;
COMMIT;
