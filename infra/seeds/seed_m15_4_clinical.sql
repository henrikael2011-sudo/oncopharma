-- M15.4 — lista Clinical: identificação segura SINTÉTICA (nomes inventados), mais pacientes para busca/agrupamento,
-- vínculos assistenciais e alertas de exemplo. Somente oncopharma_dev; role administrativa. Idempotente.
-- Variáveis: iss, sub_pharm, sub_nurse.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
ALTER TABLE patients NO FORCE ROW LEVEL SECURITY; ALTER TABLE care_assignments NO FORCE ROW LEVEL SECURITY; ALTER TABLE clinical_alerts NO FORCE ROW LEVEL SECURITY;
INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES
 ('22222222-2222-4222-8222-222222222223','11111111-1111-4111-8111-111111111111','SIM-PAC-003',true),
 ('22222222-2222-4222-8222-222222222224','11111111-1111-4111-8111-111111111111','SIM-PAC-004',true),
 ('22222222-2222-4222-8222-222222222225','11111111-1111-4111-8111-111111111111','SIM-PAC-005',true),
 ('22222222-2222-4222-8222-222222222226','11111111-1111-4111-8111-111111111111','SIM-PAC-006',true)
ON CONFLICT (id) DO NOTHING;
UPDATE patients p SET display_name=v.n, hospital_record=v.r FROM (VALUES
 ('22222222-2222-4222-8222-222222222221'::uuid,'Ana Ribeiro','PR-10021'),
 ('22222222-2222-4222-8222-222222222222'::uuid,'Bruno Costa','PR-10022'),
 ('22222222-2222-4222-8222-222222222223'::uuid,'Carlos Menezes','PR-10023'),
 ('22222222-2222-4222-8222-222222222224'::uuid,'Débora Nunes','PR-10024'),
 ('22222222-2222-4222-8222-222222222225'::uuid,'Elisa Prado','PR-10025'),   -- sem vínculo com ninguém: busca não pode revelar
 ('22222222-2222-4222-8222-222222222226'::uuid,'Fábio Rocha','PR-10026')) v(id,n,r)
WHERE p.id=v.id AND p.organization_id='11111111-1111-4111-8111-111111111111';
INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223', :'iss', :'sub_pharm'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222224', :'iss', :'sub_pharm'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222226', :'iss', :'sub_pharm'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223', :'iss', :'sub_nurse')
ON CONFLICT DO NOTHING;
-- Alerta urgente de exemplo para Carlos (lista ordenada por gravidade); recriado se não houver alerta aberto.
INSERT INTO clinical_alerts(organization_id,patient_id,code,level,status,rule_version,explanation)
SELECT '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223','lab.anc_low','urgent_review','awaiting_review','synthetic-2026.10.1',
 'Neutrófilos abaixo da referência institucional sintética antes do ciclo; requer avaliação profissional.'
WHERE NOT EXISTS (SELECT 1 FROM clinical_alerts WHERE patient_id='22222222-2222-4222-8222-222222222223' AND status='awaiting_review' AND level='urgent_review');
ALTER TABLE patients FORCE ROW LEVEL SECURITY; ALTER TABLE care_assignments FORCE ROW LEVEL SECURITY; ALTER TABLE clinical_alerts FORCE ROW LEVEL SECURITY;
COMMIT;
-- M15.4b — alocação começa vazia a cada execução E2E (histórico sintético descartável; role administrativa).
DELETE FROM allocation_sync_items WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM patient_allocations WHERE organization_id='11111111-1111-4111-8111-111111111111';
DELETE FROM allocation_sync_runs WHERE organization_id='11111111-1111-4111-8111-111111111111';
-- M15.4c — reinicia importações de PDF e pacientes criados por importação (somente sintéticos, external_reference 'PDF-').
DO $$ BEGIN IF to_regclass('pdf_imports') IS NOT NULL THEN
  DELETE FROM pdf_import_rows WHERE organization_id='11111111-1111-4111-8111-111111111111';
  DELETE FROM pdf_imports WHERE organization_id='11111111-1111-4111-8111-111111111111';
  DELETE FROM care_assignments WHERE patient_id IN (SELECT id FROM patients WHERE organization_id='11111111-1111-4111-8111-111111111111' AND synthetic AND external_reference LIKE 'PDF-%');
  DELETE FROM patients WHERE organization_id='11111111-1111-4111-8111-111111111111' AND synthetic AND external_reference LIKE 'PDF-%';
END IF; END $$;
