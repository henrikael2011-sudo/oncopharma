-- M20 — preparos FICTÍCIOS com prazos ILUSTRATIVOS ("Prazos ilustrativos — conferir na bula do fabricante").
-- Somente oncopharma_dev; role administrativa. Idempotente: recria os preparos de demonstração relativos ao horário atual
-- para os pacientes sintéticos existentes da organização de desenvolvimento.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
ALTER TABLE preparation_stability NO FORCE ROW LEVEL SECURITY;
DELETE FROM preparation_stability WHERE organization_id='11111111-1111-4111-8111-111111111111' AND source_reference LIKE 'DEMO-PREP-%';
INSERT INTO preparation_stability(organization_id,patient_id,medication,container,prepared_at,stability_hours,source_reference)
SELECT '11111111-1111-4111-8111-111111111111', p.id, v.med, v.cont, now() - make_interval(mins => v.used_min), v.hours, v.ref
FROM (VALUES
 ('22222222-2222-4222-8222-222222222221'::uuid,'Oxaliplatina 139,4 mg','SG 5% 250 mL',   500, 6.0,  'DEMO-PREP-01'),
 ('22222222-2222-4222-8222-222222222222'::uuid,'Paclitaxel 280 mg',    'SF 0,9% 500 mL',  585, 14.0, 'DEMO-PREP-02'),
 ('22222222-2222-4222-8222-222222222224'::uuid,'Gencitabina 1.900 mg', 'SF 0,9% 250 mL',  440, 16.0, 'DEMO-PREP-03'),
 ('22222222-2222-4222-8222-222222222222'::uuid,'5-FU 3.936 mg',        'bomba elastomérica 46 h', 1080, 168.0, 'DEMO-PREP-04')
) v(pid,med,cont,used_min,hours,ref) JOIN patients p ON p.id=v.pid AND p.synthetic AND p.organization_id='11111111-1111-4111-8111-111111111111';
ALTER TABLE preparation_stability FORCE ROW LEVEL SECURITY;
COMMIT;
