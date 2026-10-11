-- M2.2-M5: development-only synthetic workflow. Run with admin role only.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
CREATE TABLE IF NOT EXISTS clinical_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),patient_id uuid NOT NULL REFERENCES patients(id),cycle_id uuid REFERENCES treatment_cycles(id),
 review_type text NOT NULL CHECK(review_type IN ('pre_cycle','pharmacy','nursing','medical')),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','reviewed','blocked')),
 checklist jsonb NOT NULL DEFAULT '{}'::jsonb, rationale text, actor_issuer text NOT NULL,actor_sub text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 CONSTRAINT review_no_autoapproval CHECK(status <> 'reviewed' OR reviewed_at IS NOT NULL));
CREATE TABLE IF NOT EXISTS patient_symptom_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),patient_id uuid NOT NULL REFERENCES patients(id),
 symptom_code text NOT NULL,description text NOT NULL,reported_at timestamptz NOT NULL DEFAULT now(),source text NOT NULL,synthetic boolean NOT NULL DEFAULT true CHECK(synthetic=true),
 triage_status text NOT NULL DEFAULT 'pending' CHECK(triage_status IN ('pending','urgent_review','reviewed')),source_reference text NOT NULL,
 UNIQUE(organization_id,source_reference));
CREATE TABLE IF NOT EXISTS clinical_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),patient_id uuid NOT NULL REFERENCES patients(id),
 source_report_id uuid REFERENCES patient_symptom_reports(id),code text NOT NULL,level text NOT NULL CHECK(level IN ('needs_review','urgent_review')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),rule_version text NOT NULL,explanation text NOT NULL,
 assigned_to text,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);
CREATE TABLE IF NOT EXISTS clinical_interventions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),patient_id uuid NOT NULL REFERENCES patients(id),alert_id uuid REFERENCES clinical_alerts(id),
 type text NOT NULL,note text NOT NULL,decision text NOT NULL CHECK(decision IN ('pending','accepted','declined','referred')),
 actor_issuer text NOT NULL,actor_sub text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS patient_guidance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),patient_id uuid NOT NULL REFERENCES patients(id),
 intervention_id uuid REFERENCES clinical_interventions(id),body text NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','delivered')),
 approved_by text,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT guidance_approval CHECK(status='draft' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)));
CREATE TABLE IF NOT EXISTS clinical_protocol_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations(id),code text NOT NULL,version text NOT NULL,
 content jsonb NOT NULL,approval_status text NOT NULL DEFAULT 'draft' CHECK(approval_status IN ('draft','approved','retired')),
 approved_by text,approved_at timestamptz,UNIQUE(organization_id,code,version),
 CONSTRAINT protocol_approval CHECK(approval_status<>'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['clinical_reviews','patient_symptom_reports','clinical_alerts','clinical_interventions','patient_guidance','clinical_protocol_versions'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (organization_id = current_setting(''app.organization_id'',true)::uuid)',t||'_tenant_read',t);
 EXECUTE format('GRANT SELECT ON %I TO oncopharma_app',t);
 END LOOP; END $$;
-- No GRANT INSERT/UPDATE/DELETE to runtime role until clinical workflow authorization is reviewed.
