-- M15.3 — cada execução E2E começa sem convites pendentes nem cuidadores ativos para os pacientes sintéticos.
-- Somente oncopharma_dev; executar com role administrativa (histórico preservado: cancela/revoga, nunca apaga).
BEGIN;
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
ALTER TABLE caregiver_invites NO FORCE ROW LEVEL SECURITY; ALTER TABLE caregiver_links NO FORCE ROW LEVEL SECURITY;
UPDATE caregiver_invites SET cancelled_at=now() WHERE used_at IS NULL AND cancelled_at IS NULL AND patient_id IN ('22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222');
UPDATE caregiver_links SET revoked_at=now() WHERE revoked_at IS NULL AND patient_id IN ('22222222-2222-4222-8222-222222222221','22222222-2222-4222-8222-222222222222');
ALTER TABLE caregiver_invites FORCE ROW LEVEL SECURITY; ALTER TABLE caregiver_links FORCE ROW LEVEL SECURITY;
COMMIT;
