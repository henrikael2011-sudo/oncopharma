-- M20 — Prazos de estabilidade de preparos (bolsas/infusores) para a "Visão geral" do farmacêutico. SOMENTE sintético em DEV.
-- Modelo mínimo: cada preparo tem início da estabilidade e prazo (horas). Os prazos semeados são ILUSTRATIVOS:
-- a fonte é sempre "Prazos ilustrativos — conferir na bula do fabricante"; o sistema não define estabilidade real.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
CREATE TABLE IF NOT EXISTS preparation_stability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  medication text NOT NULL CHECK (length(medication) BETWEEN 2 AND 120),
  container text NOT NULL CHECK (length(container) BETWEEN 2 AND 120),
  prepared_at timestamptz NOT NULL,
  stability_hours numeric(8,2) NOT NULL CHECK (stability_hours > 0 AND stability_hours <= 2400),
  stability_source text NOT NULL DEFAULT 'Prazos ilustrativos — conferir na bula do fabricante' CHECK (length(stability_source) BETWEEN 10 AND 200),
  status text NOT NULL DEFAULT 'pending_release' CHECK (status IN ('pending_release','released','administered','discarded')),
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic),
  source_reference text NOT NULL CHECK (length(source_reference) BETWEEN 3 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_reference)
);
CREATE INDEX IF NOT EXISTS preparation_stability_patient ON preparation_stability(organization_id, patient_id);
ALTER TABLE preparation_stability ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_stability FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preparation_stability_tenant ON preparation_stability;
CREATE POLICY preparation_stability_tenant ON preparation_stability FOR SELECT USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
-- Somente leitura para a aplicação nesta etapa (dados semeados pela role administrativa).
GRANT SELECT ON preparation_stability TO oncopharma_app;
COMMIT;
