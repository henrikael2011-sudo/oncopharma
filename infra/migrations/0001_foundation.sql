-- RASCUNHO M0: schema mínimo, NÃO aplicar a pacientes reais.
-- Migrações futuras precisam de RLS/ABAC, política de retenção e auditoria clínica completa.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  external_reference text,
  synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_reference)
);
CREATE INDEX patients_by_org ON patients (organization_id);
-- Não há endpoints de paciente até autenticação, autorização por organização e auditoria.
