-- Exclusivamente dados inventados para demonstração. Não usar em produção.
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente DEV'; END IF; END $$;
INSERT INTO clinical_allergies(organization_id,patient_id,substance,reaction,status,recorded_at,source_reference) VALUES
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Nenhuma alergia confirmada','Histórico não conciliado','unconfirmed','2026-10-10 12:00+00','SIM-ALG-001'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Penicilina','Exantema referido (fictício)','unconfirmed','2026-10-10 12:00+00','SIM-ALG-002') ON CONFLICT DO NOTHING;
INSERT INTO clinical_measurements(organization_id,patient_id,kind,value,unit,measured_at,source_reference) VALUES
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','weight',72.4,'kg','2026-10-08 12:00+00','SIM-MED-001'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','height',170,'cm','2026-10-08 12:00+00','SIM-MED-002'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','weight',64.8,'kg','2026-10-08 12:00+00','SIM-MED-003') ON CONFLICT DO NOTHING;
INSERT INTO clinical_labs(organization_id,patient_id,analyte_code,analyte_label,result_value,unit,reference_low,reference_high,collected_at,source_reference) VALUES
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','ANC','Neutrófilos absolutos',1850,'/µL',1500,7500,'2026-10-09 10:00+00','SIM-LAB-001'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','PLT','Plaquetas',164000,'/µL',150000,450000,'2026-10-09 10:00+00','SIM-LAB-002'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','HGB','Hemoglobina',10.8,'g/dL',12,16,'2026-10-09 10:00+00','SIM-LAB-003') ON CONFLICT DO NOTHING;
INSERT INTO clinical_medication_orders(id,organization_id,patient_id,medication,dose_value,dose_unit,route,frequency_text,status,ordered_at,source_reference) VALUES
('66666666-6666-4666-8666-666666666661','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Ondansetrona',8,'mg','IV','Conforme prescrição fictícia','active','2026-10-09 10:00+00','SIM-RX-001'),
('66666666-6666-4666-8666-666666666662','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Ondansetrona',8,'mg','IV','Conforme prescrição fictícia','active','2026-10-09 10:00+00','SIM-RX-002') ON CONFLICT DO NOTHING;
INSERT INTO clinical_medication_administrations(organization_id,patient_id,order_id,medication,administered_at,dose_value,dose_unit,status,source_reference) VALUES
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','66666666-6666-4666-8666-666666666661','Ondansetrona','2026-10-09 11:00+00',8,'mg','completed','SIM-ADM-001') ON CONFLICT DO NOTHING;
INSERT INTO pharmacy_assessments(organization_id,patient_id,title,summary,review_status,authored_at,source_reference) VALUES
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','Conciliação farmacêutica','Avaliação sintética pendente de revisão profissional; não representa conduta validada.','pending','2026-10-10 11:00+00','SIM-FARM-STR-001'),
('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Revisão de suporte','Conferência sintética de antieméticos; não representa recomendação clínica.','pending','2026-10-10 11:00+00','SIM-FARM-STR-002') ON CONFLICT DO NOTHING;
COMMIT;
