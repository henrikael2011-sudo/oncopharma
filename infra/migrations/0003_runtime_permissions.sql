-- M1.2: role de execução com privilégios mínimos, separado do dono do schema.
-- Execute com DATABASE_URL_ADMIN em DEV. Nunca use a conta de migração na API.
DO $$ BEGIN
  IF current_database() <> 'oncopharma_dev' THEN
    RAISE EXCEPTION 'M1.2 só pode ser configurado em oncopharma_dev';
  END IF;
END $$;
-- Criar a role de login em um script separado para não armazenar senhas em SQL.
-- Aqui concedemos apenas o necessário à role já provisionada.
GRANT CONNECT ON DATABASE oncopharma_dev TO oncopharma_app;
GRANT USAGE ON SCHEMA public TO oncopharma_app;
GRANT SELECT ON organizations, memberships, patients, care_assignments TO oncopharma_app;
GRANT INSERT ON audit_events TO oncopharma_app;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO oncopharma_app;
-- Não conceder BYPASSRLS, TRUNCATE, UPDATE ou DELETE.

-- M14.3: auditoria append-only com isolamento institucional também na escrita.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_insert_tenant ON audit_events;
CREATE POLICY audit_events_insert_tenant ON audit_events FOR INSERT
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true),'')::uuid);
-- Sem SELECT/UPDATE/DELETE para a role da API. INSERT é concedido acima.
