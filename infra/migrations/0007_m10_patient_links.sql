-- M10: vínculo de identidade Care somente DEV. Migração executada com papel administrativo.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
CREATE TABLE IF NOT EXISTS patient_portal_links (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  oidc_issuer text NOT NULL,
  oidc_sub text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,patient_id,oidc_issuer,oidc_sub)
);
ALTER TABLE patient_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_portal_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patient_portal_links_tenant_read ON patient_portal_links;
CREATE POLICY patient_portal_links_tenant_read ON patient_portal_links FOR SELECT USING(organization_id=current_setting('app.organization_id',true)::uuid);
GRANT SELECT ON patient_portal_links TO oncopharma_app;
-- Permissões mínimas para a API executar o fluxo sintético. Nenhum DELETE/UPDATE em relatórios.
GRANT INSERT ON patient_symptom_reports, clinical_alerts, clinical_interventions, audit_events TO oncopharma_app;
GRANT UPDATE(status) ON clinical_alerts TO oncopharma_app;
DROP POLICY IF EXISTS symptom_insert_tenant ON patient_symptom_reports;
CREATE POLICY symptom_insert_tenant ON patient_symptom_reports FOR INSERT WITH CHECK(organization_id=current_setting('app.organization_id',true)::uuid AND synthetic=true);
DROP POLICY IF EXISTS alert_insert_tenant ON clinical_alerts;
CREATE POLICY alert_insert_tenant ON clinical_alerts FOR INSERT WITH CHECK(organization_id=current_setting('app.organization_id',true)::uuid);
DROP POLICY IF EXISTS alert_update_tenant ON clinical_alerts;
CREATE POLICY alert_update_tenant ON clinical_alerts FOR UPDATE USING(organization_id=current_setting('app.organization_id',true)::uuid) WITH CHECK(organization_id=current_setting('app.organization_id',true)::uuid);
DROP POLICY IF EXISTS intervention_insert_tenant ON clinical_interventions;
CREATE POLICY intervention_insert_tenant ON clinical_interventions FOR INSERT WITH CHECK(organization_id=current_setting('app.organization_id',true)::uuid);
-- Auditoria deve usar a política de INSERT já definida em 0002/0003; confirme antes de migrar.
