-- M15.4b — Alocação hospitalar (unidade/andar/quarto/leito): origem "hospital" (Sincronizar via integration-gateway,
-- FHIR R4 Encounter.location ou HL7 v2 ADT PV1-3) ou "manual" (quando o hospital não informa), com autoria, horário,
-- histórico (insert-only + superseded_at) e divergências registradas. Alocação NÃO é dado clínico; nunca sobrescreve manual em silêncio.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS allocation_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  source_system text NOT NULL CHECK (length(source_system) BETWEEN 2 AND 80),
  source_format text NOT NULL CHECK (source_format IN ('fhir_r4','hl7v2_adt')),
  adapter_version text NOT NULL CHECK (length(adapter_version) BETWEEN 1 AND 60),
  fetched_at timestamptz NOT NULL,
  actor_issuer text NOT NULL, actor_sub text NOT NULL, actor_role text NOT NULL CHECK (actor_role IN ('pharmacist','physician','nurse','clinical_manager')),
  received int NOT NULL CHECK (received >= 0), updated int NOT NULL DEFAULT 0, unchanged int NOT NULL DEFAULT 0, conflicts int NOT NULL DEFAULT 0, not_found int NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patient_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  unit text NOT NULL CHECK (length(unit) BETWEEN 2 AND 80),
  floor text CHECK (floor IS NULL OR length(floor) BETWEEN 1 AND 40),
  room text CHECK (room IS NULL OR length(room) BETWEEN 1 AND 40),
  bed text CHECK (bed IS NULL OR length(bed) BETWEEN 1 AND 20),
  source text NOT NULL CHECK (source IN ('hospital','manual')),
  sync_run_id uuid REFERENCES allocation_sync_runs(id),
  source_ref text CHECK (source_ref IS NULL OR length(source_ref) <= 120),
  recorded_by_issuer text NOT NULL, recorded_by_sub text NOT NULL,
  recorded_by_role text NOT NULL CHECK (recorded_by_role IN ('pharmacist','physician','nurse','clinical_manager')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  CONSTRAINT allocation_origin CHECK ((source = 'hospital') = (sync_run_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS patient_allocation_current ON patient_allocations(organization_id, patient_id) WHERE superseded_at IS NULL;
CREATE TABLE IF NOT EXISTS allocation_sync_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  run_id uuid NOT NULL REFERENCES allocation_sync_runs(id),
  patient_id uuid REFERENCES patients(id),
  hospital_record text NOT NULL CHECK (hospital_record ~ '^[A-Za-z0-9-]{3,30}$'),
  unit text NOT NULL CHECK (length(unit) BETWEEN 2 AND 80), floor text, room text, bed text,
  source_ref text CHECK (source_ref IS NULL OR length(source_ref) <= 120),
  outcome text NOT NULL CHECK (outcome IN ('updated','unchanged','confirmed','conflict','not_found')),
  resolved_at timestamptz, resolved_by_sub text, resolution text CHECK (resolution IS NULL OR resolution IN ('accepted_hospital','kept_manual')),
  CONSTRAINT sync_item_patient CHECK ((outcome = 'not_found') = (patient_id IS NULL)),
  CONSTRAINT sync_item_resolution CHECK ((resolved_at IS NULL) = (resolution IS NULL) AND (resolution IS NULL OR outcome = 'conflict'))
);
-- Histórico imutável: só superseded_at pode ser preenchido, uma única vez. Divergência: só resolução, uma vez.
CREATE OR REPLACE FUNCTION patient_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL OR (to_jsonb(NEW) - 'superseded_at') <> (to_jsonb(OLD) - 'superseded_at') THEN
    RAISE EXCEPTION 'Alocação registrada é imutável (apenas substituição)' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS patient_allocation_guard ON patient_allocations;
CREATE TRIGGER patient_allocation_guard BEFORE UPDATE ON patient_allocations FOR EACH ROW EXECUTE FUNCTION patient_allocation_guard();
CREATE OR REPLACE FUNCTION allocation_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.resolved_at IS NOT NULL OR (to_jsonb(NEW) - 'resolved_at' - 'resolved_by_sub' - 'resolution') <> (to_jsonb(OLD) - 'resolved_at' - 'resolved_by_sub' - 'resolution') THEN
    RAISE EXCEPTION 'Divergência já resolvida ou alteração não permitida' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS allocation_item_guard ON allocation_sync_items;
CREATE TRIGGER allocation_item_guard BEFORE UPDATE ON allocation_sync_items FOR EACH ROW EXECUTE FUNCTION allocation_item_guard();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['allocation_sync_runs','patient_allocations','allocation_sync_items'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant', t);
  EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', t||'_tenant', t);
END LOOP; END $$;
GRANT SELECT, INSERT ON allocation_sync_runs, patient_allocations, allocation_sync_items TO oncopharma_app;
GRANT UPDATE (updated, unchanged, conflicts, not_found) ON allocation_sync_runs TO oncopharma_app;
GRANT UPDATE (superseded_at) ON patient_allocations TO oncopharma_app;
GRANT UPDATE (resolved_at, resolved_by_sub, resolution) ON allocation_sync_items TO oncopharma_app;
COMMIT;
