-- M2: prontuário longitudinal sintético, leitura controlada, sem prescrição nem conduta automatizada.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Migração M2 restrita ao desenvolvimento'; END IF; END $$;
CREATE TABLE oncology_protocols (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 code text NOT NULL, label text NOT NULL, revision text NOT NULL, approved boolean NOT NULL DEFAULT false,
 UNIQUE(organization_id,code,revision));
CREATE TABLE treatment_cycles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 patient_id uuid NOT NULL REFERENCES patients(id), protocol_id uuid NOT NULL REFERENCES oncology_protocols(id),
 cycle_number integer NOT NULL CHECK(cycle_number>0), planned_on date, status text NOT NULL CHECK(status IN ('planned','under_review','completed','cancelled')),
 UNIQUE(patient_id,protocol_id,cycle_number));
CREATE TABLE clinical_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 patient_id uuid NOT NULL REFERENCES patients(id), category text NOT NULL CHECK(category IN ('symptom','laboratory','nursing','medical','pharmacy','vital')),
 title text NOT NULL, value_text text NOT NULL, observed_at timestamptz NOT NULL,
 source_type text NOT NULL, source_reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX observations_patient_date ON clinical_observations(patient_id,observed_at DESC);
-- RLS para leitura por tenant; acesso adicional à atribuição é aplicado pela API.
ALTER TABLE oncology_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncology_protocols FORCE ROW LEVEL SECURITY;
CREATE POLICY oncology_protocols_tenant ON oncology_protocols FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER TABLE treatment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY treatment_cycles_tenant ON treatment_cycles FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
ALTER TABLE clinical_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_observations FORCE ROW LEVEL SECURITY;
CREATE POLICY clinical_observations_tenant ON clinical_observations FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT ON oncology_protocols,treatment_cycles,clinical_observations TO oncopharma_app;
