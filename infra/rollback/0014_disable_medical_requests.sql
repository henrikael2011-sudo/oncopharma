-- Contingência não destrutiva: executar como administrador, com transação externa.
-- Não remove tabelas, eventos, sequências, dados nem permissões dos módulos anteriores.
DO $$ BEGIN IF current_database()<>'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
REVOKE ALL PRIVILEGES ON medical_requests,medical_request_events,on_call_shifts,request_priority_criteria FROM oncopharma_app;
-- Privilégios de coluna precisam de revogação explícita.
REVOKE UPDATE(justification,priority,evidence,status,response,outcome,official_reference) ON medical_requests FROM oncopharma_app;
REVOKE ALL ON SEQUENCE medical_request_events_id_seq FROM oncopharma_app;
REVOKE ALL ON FUNCTION sam_member(uuid,text[]),sam_link(uuid,uuid),sam_destination_active(medical_requests),sam_recipient(medical_requests),sam_access(medical_requests),sam_evidence(uuid,uuid,jsonb),sam_request_guard(),sam_request_history(),sam_record_read(uuid,uuid) FROM oncopharma_app;
