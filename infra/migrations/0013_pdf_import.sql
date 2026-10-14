-- M15.4c — Importação de lista de pacientes por PDF exportado pelo hospital (Tasy/MV/outro), SOMENTE sintético em DEV.
-- Prévia obrigatória → confirmação humana → escrita com proveniência ("PDF importado", data/hora, importador, hash do arquivo);
-- original guardado CIFRADO (AES-256-GCM na aplicação; a role da aplicação não lê o conteúdo cifrado de volta).
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS pdf_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 120),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes int NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  layout_id text NOT NULL CHECK (length(layout_id) BETWEEN 3 AND 60), layout_label text NOT NULL CHECK (length(layout_label) BETWEEN 3 AND 120),
  encrypted bytea NOT NULL, iv bytea NOT NULL CHECK (length(iv) = 12), tag bytea NOT NULL CHECK (length(tag) = 16), key_id text NOT NULL CHECK (length(key_id) BETWEEN 8 AND 64),
  status text NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed','confirmed','discarded')),
  uploaded_by_issuer text NOT NULL, uploaded_by_sub text NOT NULL,
  uploaded_by_role text NOT NULL CHECK (uploaded_by_role IN ('pharmacist','nurse','clinical_manager')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz, created_count int, updated_count int, conflicts_applied int, skipped_count int,
  CONSTRAINT import_decided CHECK ((status = 'previewed') = (decided_at IS NULL))
);
CREATE TABLE IF NOT EXISTS pdf_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  import_id uuid NOT NULL REFERENCES pdf_imports(id),
  line int NOT NULL CHECK (line BETWEEN 1 AND 100000),
  record text CHECK (record IS NULL OR length(record) <= 30), name text CHECK (name IS NULL OR length(name) <= 80),
  unit text CHECK (unit IS NULL OR length(unit) <= 80), floor text, room text, bed text,
  action text NOT NULL CHECK (action IN ('create','update','unchanged','conflict','not_linked','invalid')),
  patient_id uuid REFERENCES patients(id),
  current_label text CHECK (current_label IS NULL OR length(current_label) <= 240),
  name_divergent boolean NOT NULL DEFAULT false,
  error text CHECK (error IS NULL OR length(error) <= 200),
  applied boolean NOT NULL DEFAULT false,
  skip_reason text CHECK (skip_reason IS NULL OR length(skip_reason) <= 200)
);
-- Imutabilidade: importação só sai de "previewed" uma vez; linha só passa a aplicada (ou ganha motivo de não aplicação) uma vez.
CREATE OR REPLACE FUNCTION pdf_import_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'previewed' OR NEW.status = 'previewed'
     OR (to_jsonb(NEW) - ARRAY['status','decided_at','created_count','updated_count','conflicts_applied','skipped_count']) <> (to_jsonb(OLD) - ARRAY['status','decided_at','created_count','updated_count','conflicts_applied','skipped_count']) THEN
    RAISE EXCEPTION 'Importação já decidida ou alteração não permitida' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pdf_import_guard ON pdf_imports;
CREATE TRIGGER pdf_import_guard BEFORE UPDATE ON pdf_imports FOR EACH ROW EXECUTE FUNCTION pdf_import_guard();
CREATE OR REPLACE FUNCTION pdf_import_row_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.applied OR OLD.skip_reason IS NOT NULL OR (to_jsonb(NEW) - ARRAY['applied','skip_reason','patient_id']) <> (to_jsonb(OLD) - ARRAY['applied','skip_reason','patient_id'])
     OR (OLD.patient_id IS NOT NULL AND NEW.patient_id IS DISTINCT FROM OLD.patient_id) THEN
    RAISE EXCEPTION 'Linha de importação imutável' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pdf_import_row_guard ON pdf_import_rows;
CREATE TRIGGER pdf_import_row_guard BEFORE UPDATE ON pdf_import_rows FOR EACH ROW EXECUTE FUNCTION pdf_import_row_guard();
-- Alocação com origem "pdf" (proveniência = importação).
ALTER TABLE patient_allocations ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES pdf_imports(id);
ALTER TABLE patient_allocations DROP CONSTRAINT IF EXISTS patient_allocations_source_check;
ALTER TABLE patient_allocations ADD CONSTRAINT patient_allocations_source_check CHECK (source IN ('hospital','manual','pdf'));
ALTER TABLE patient_allocations DROP CONSTRAINT IF EXISTS allocation_origin;
ALTER TABLE patient_allocations ADD CONSTRAINT allocation_origin CHECK ((source = 'hospital') = (sync_run_id IS NOT NULL) AND (source = 'pdf') = (import_id IS NOT NULL));
-- Pacientes: criação SOMENTE sintética, via importação confirmada (requisito do Henrikael, M15.4c). Sem UPDATE/DELETE.
DROP POLICY IF EXISTS patients_insert_synthetic ON patients;
CREATE POLICY patients_insert_synthetic ON patients FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid AND synthetic = true AND hospital_record IS NOT NULL AND display_name IS NOT NULL);
GRANT INSERT (organization_id, external_reference, synthetic, display_name, hospital_record) ON patients TO oncopharma_app;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['pdf_imports','pdf_import_rows'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant', t);
  EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t||'_tenant', t);
END LOOP; END $$;
-- Conteúdo cifrado: a aplicação grava mas NÃO lê de volta (SELECT por coluna, sem encrypted/iv/tag).
GRANT INSERT ON pdf_imports TO oncopharma_app;
GRANT SELECT (id, organization_id, file_name, sha256, size_bytes, layout_id, layout_label, key_id, status, uploaded_by_issuer, uploaded_by_sub, uploaded_by_role, uploaded_at, decided_at, created_count, updated_count, conflicts_applied, skipped_count) ON pdf_imports TO oncopharma_app;
GRANT UPDATE (status, decided_at, created_count, updated_count, conflicts_applied, skipped_count) ON pdf_imports TO oncopharma_app;
GRANT SELECT, INSERT ON pdf_import_rows TO oncopharma_app;
GRANT UPDATE (applied, skip_reason, patient_id) ON pdf_import_rows TO oncopharma_app;
-- Vínculo do importador SOMENTE com paciente que ele mesmo criou por linha de importação aplicada (sem vínculo arbitrário).
DROP POLICY IF EXISTS assignments_insert_pdf ON care_assignments;
CREATE POLICY assignments_insert_pdf ON care_assignments FOR INSERT WITH CHECK (
  organization_id = nullif(current_setting('app.organization_id', true), '')::uuid AND active = true
  AND EXISTS (SELECT 1 FROM pdf_import_rows r JOIN pdf_imports i ON i.id = r.import_id
    WHERE r.patient_id = care_assignments.patient_id AND r.organization_id = care_assignments.organization_id AND r.applied AND r.action = 'create'
      AND i.uploaded_by_issuer = care_assignments.oidc_issuer AND i.uploaded_by_sub = care_assignments.oidc_sub));
GRANT INSERT (organization_id, patient_id, oidc_issuer, oidc_sub, active) ON care_assignments TO oncopharma_app;
COMMIT;
