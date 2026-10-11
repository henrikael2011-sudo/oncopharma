-- M2: dados exclusivamente fictícios; aplicar após seed_two_synthetic_patients.sql.
BEGIN;
DO $$ BEGIN IF current_database()<>'oncopharma_dev' THEN RAISE EXCEPTION 'Somente DEV'; END IF; END $$;
ALTER TABLE oncology_protocols NO FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_observations NO FORCE ROW LEVEL SECURITY;
INSERT INTO oncology_protocols(id,organization_id,code,label,revision,approved) VALUES
('33333333-3333-4333-8333-333333333331','11111111-1111-4111-8111-111111111111','FOLFOX','FOLFOX — protocolo ilustrativo','TESTE-1',false),
('33333333-3333-4333-8333-333333333332','11111111-1111-4111-8111-111111111111','AC-T','AC-T — protocolo ilustrativo','TESTE-1',false)
ON CONFLICT DO NOTHING;
INSERT INTO treatment_cycles(id,organization_id,patient_id,protocol_id,cycle_number,planned_on,status) VALUES
('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','33333333-3333-4333-8333-333333333331',3,'2026-10-16','under_review'),
('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333332',2,'2026-10-19','planned')
ON CONFLICT DO NOTHING;
INSERT INTO clinical_observations(id,organization_id,patient_id,category,title,value_text,observed_at,source_type,source_reference) VALUES
('55555555-5555-4555-8555-555555555551','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','symptom','Formigamento','Relato fictício de formigamento distal após infusão','2026-10-09 14:00:00+00','patient_report','SIM-CARE-001'),
('55555555-5555-4555-8555-555555555552','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','nursing','Sensibilidade ao frio','Evolução de enfermagem fictícia: desconforto ao contato com frio','2026-10-09 16:00:00+00','nursing_note','SIM-ENF-001'),
('55555555-5555-4555-8555-555555555553','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','symptom','Náusea','Relato fictício: náusea leve, sem vômitos','2026-10-09 12:00:00+00','patient_report','SIM-CARE-002'),
('55555555-5555-4555-8555-555555555554','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','pharmacy','Revisão de suporte','Registro fictício: antieméticos ainda não conciliados','2026-10-09 18:00:00+00','pharmacy_note','SIM-FARM-001')
ON CONFLICT DO NOTHING;
ALTER TABLE oncology_protocols FORCE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_observations FORCE ROW LEVEL SECURITY;
COMMIT;
