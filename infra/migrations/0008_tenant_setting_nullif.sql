-- M14.5 (R1): padroniza o contexto de tenant nas políticas criadas em 0006/0007.
-- Problema comprovado: após uma transação com set_config(..., true), a sessão reutilizada pelo pool guarda
-- app.organization_id = '' e `''::uuid` gera erro 22P02 (fail-closed, porém erro 500) em consultas sem contexto.
-- Correção: nullif(...,'')::uuid, idêntico ao padrão de 0002/0003/0004/0005. Sem contexto => NULL => nenhuma linha.
-- Não amplia acesso: apenas troca erro por "zero linhas". Somente DEV; executar com role administrativa.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_reviews','patient_symptom_reports','clinical_alerts','clinical_interventions','patient_guidance','clinical_protocol_versions'] LOOP
    EXECUTE format('ALTER POLICY %I ON %I USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)', t||'_tenant_read', t);
  END LOOP;
END $$;
ALTER POLICY patient_portal_links_tenant_read ON patient_portal_links
  USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER POLICY symptom_insert_tenant ON patient_symptom_reports
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid AND synthetic = true);
ALTER POLICY alert_insert_tenant ON clinical_alerts
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER POLICY alert_update_tenant ON clinical_alerts
  USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER POLICY intervention_insert_tenant ON clinical_interventions
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
COMMIT;
