-- M15.5 / D-012. Adição isolada; somente banco sintético, sem alterar tabelas/fluxos clínicos existentes.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
ALTER TABLE memberships ADD COLUMN display_name text CHECK(display_name IS NULL OR length(trim(display_name)) BETWEEN 2 AND 80);
CREATE TABLE on_call_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), unit text NOT NULL,
 physician_issuer text NOT NULL, physician_sub text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic), CHECK(ends_at>starts_at)
);
CREATE INDEX on_call_lookup ON on_call_shifts(organization_id,unit,starts_at,ends_at);
CREATE TABLE request_priority_criteria (
 organization_id uuid NOT NULL REFERENCES organizations(id), unit text NOT NULL, priority text NOT NULL CHECK(priority IN ('routine','priority','urgent')),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 3 AND 500), sla_minutes integer CHECK(sla_minutes>0),
 clinically_approved boolean NOT NULL DEFAULT false CHECK(NOT clinically_approved), synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),
 PRIMARY KEY(organization_id,unit,priority)
);
CREATE TABLE medical_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), patient_id uuid NOT NULL REFERENCES patients(id),
 author_issuer text NOT NULL, author_sub text NOT NULL, author_role text NOT NULL CHECK(author_role IN ('pharmacist','nurse','physician')),
 recipient_mode text NOT NULL CHECK(recipient_mode IN ('specific','on_call')), recipient_issuer text, recipient_sub text, shift_id uuid REFERENCES on_call_shifts(id),
 unit text NOT NULL, justification text NOT NULL CHECK(length(trim(justification)) BETWEEN 10 AND 2000),
 priority text NOT NULL CHECK(priority IN ('routine','priority','urgent')), criteria_snapshot jsonb,
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence) BETWEEN 1 AND 10),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','in_review','accepted','adjusted','declined','completed','discarded')),
 response text CHECK(length(trim(response)) BETWEEN 3 AND 2000), outcome text CHECK(length(trim(outcome)) BETWEEN 3 AND 2000),
 official_reference text CHECK(length(trim(official_reference)) BETWEEN 3 AND 300),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz, reviewed_at timestamptz, responded_at timestamptz, completed_at timestamptz,
 synthetic boolean NOT NULL DEFAULT true CHECK(synthetic)
);
CREATE INDEX medical_request_patient ON medical_requests(organization_id,patient_id,created_at DESC);
CREATE INDEX medical_request_recipient ON medical_requests(organization_id,recipient_issuer,recipient_sub,status);
CREATE TABLE medical_request_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id), request_id uuid NOT NULL REFERENCES medical_requests(id),
 revision integer NOT NULL, action text NOT NULL, actor_issuer text NOT NULL, actor_sub text NOT NULL, actor_role text NOT NULL,
 at timestamptz NOT NULL DEFAULT now(), access_reason text NOT NULL CHECK(access_reason IN ('author','linked','on_call')),
 snapshot jsonb NOT NULL
);
-- Contexto de identidade vem APENAS do JWT validado na API, local à transação; nunca do corpo/cabeçalhos do cliente.
CREATE FUNCTION sam_member(o uuid, roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('app.sam_mfa',true)='true',false) AND EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=o AND m.active
 AND m.oidc_issuer=current_setting('app.sam_issuer',true) AND m.oidc_sub=current_setting('app.sam_sub',true) AND m.role=ANY(roles))
$$;
CREATE FUNCTION sam_link(o uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM care_assignments a JOIN patients t ON t.id=a.patient_id AND t.organization_id=a.organization_id
 WHERE a.organization_id=o AND a.patient_id=p AND a.active AND t.synthetic
 AND a.oidc_issuer=current_setting('app.sam_issuer',true) AND a.oidc_sub=current_setting('app.sam_sub',true))
$$;
CREATE FUNCTION sam_recipient(r medical_requests) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT r.recipient_issuer=current_setting('app.sam_issuer',true) AND r.recipient_sub=current_setting('app.sam_sub',true)
 AND sam_member(r.organization_id,ARRAY['physician']) AND r.status NOT IN ('draft','discarded') AND (
 (r.recipient_mode='specific' AND sam_link(r.organization_id,r.patient_id)) OR
 (r.recipient_mode='on_call' AND EXISTS(SELECT 1 FROM on_call_shifts s WHERE s.id=r.shift_id AND s.organization_id=r.organization_id AND s.unit=r.unit
 AND s.physician_issuer=r.recipient_issuer AND s.physician_sub=r.recipient_sub AND s.starts_at<=now() AND s.ends_at>now())))
$$;
CREATE FUNCTION sam_access(r medical_requests) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT r.organization_id=nullif(current_setting('app.organization_id',true),'')::uuid AND
 ((r.author_issuer=current_setting('app.sam_issuer',true) AND r.author_sub=current_setting('app.sam_sub',true)
 AND sam_member(r.organization_id,ARRAY['pharmacist','nurse','physician']) AND sam_link(r.organization_id,r.patient_id)) OR sam_recipient(r))
$$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['on_call_shifts','request_priority_criteria','medical_requests','medical_request_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 END LOOP; END $$;
CREATE POLICY shifts_read ON on_call_shifts FOR SELECT USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE POLICY criteria_read ON request_priority_criteria FOR SELECT USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE POLICY request_read ON medical_requests FOR SELECT USING(sam_access(medical_requests));
CREATE POLICY request_insert ON medical_requests FOR INSERT WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
 AND author_issuer=current_setting('app.sam_issuer',true) AND author_sub=current_setting('app.sam_sub',true)
 AND sam_member(organization_id,ARRAY[author_role]) AND sam_link(organization_id,patient_id));
CREATE POLICY request_update ON medical_requests FOR UPDATE USING(sam_access(medical_requests)) WITH CHECK(sam_access(medical_requests));
CREATE POLICY request_event_read ON medical_request_events FOR SELECT USING(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM medical_requests r WHERE r.id=request_id AND r.organization_id=medical_request_events.organization_id));
CREATE POLICY request_event_insert ON medical_request_events FOR INSERT WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::uuid
 AND actor_issuer=current_setting('app.sam_issuer',true) AND actor_sub=current_setting('app.sam_sub',true)
 AND sam_member(organization_id,ARRAY[actor_role]) AND EXISTS(SELECT 1 FROM medical_requests r WHERE r.id=request_id AND r.organization_id=medical_request_events.organization_id));
-- Gera snapshot e Provenance diretamente dos registros de origem, sem aceitar texto clínico do cliente.
CREATE FUNCTION sam_evidence(o uuid,p uuid,refs jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE ref jsonb; row_data jsonb; result jsonb='[]'; tab text; at_col text; source_ref text; source_at text;
BEGIN
 IF jsonb_typeof(refs)<>'array' OR jsonb_array_length(refs) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Selecione de 1 a 10 evidências' USING ERRCODE='check_violation'; END IF;
 FOR ref IN SELECT * FROM jsonb_array_elements(refs) LOOP
  SELECT CASE ref->>'type' WHEN 'alert' THEN 'clinical_alerts' WHEN 'order' THEN 'clinical_medication_orders' WHEN 'administration' THEN 'clinical_medication_administrations' WHEN 'lab' THEN 'clinical_labs' WHEN 'symptom' THEN 'patient_symptom_reports' END INTO tab;
  IF tab IS NULL THEN RAISE EXCEPTION 'Tipo de evidência inválido' USING ERRCODE='check_violation'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id=$1 AND organization_id=$2 AND patient_id=$3',tab) INTO row_data USING (ref->>'id')::uuid,o,p;
  IF row_data IS NULL THEN RAISE EXCEPTION 'Evidência não pertence ao paciente/instituição' USING ERRCODE='check_violation'; END IF;
  at_col := CASE ref->>'type' WHEN 'alert' THEN 'created_at' WHEN 'order' THEN 'ordered_at' WHEN 'administration' THEN 'administered_at' WHEN 'lab' THEN 'collected_at' ELSE 'reported_at' END;
  source_ref := coalesce(row_data->>'source_reference','alert:'||(ref->>'id')); source_at := row_data->>at_col;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) e WHERE e->>'type'=ref->>'type' AND e->>'id'=ref->>'id') THEN RAISE EXCEPTION 'Evidência repetida' USING ERRCODE='check_violation'; END IF;
  result := result || jsonb_build_array(jsonb_build_object('type',ref->>'type','id',ref->>'id','source_reference',source_ref,'source_at',source_at,'snapshot',row_data-'organization_id'-'patient_id'));
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION sam_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE is_author boolean; is_recipient boolean; count_shifts integer; chosen on_call_shifts; pc request_priority_criteria;
BEGIN
 is_author := NEW.author_issuer=current_setting('app.sam_issuer',true) AND NEW.author_sub=current_setting('app.sam_sub',true)
 AND sam_member(NEW.organization_id,ARRAY[NEW.author_role]) AND sam_link(NEW.organization_id,NEW.patient_id);
 IF TG_OP='INSERT' THEN
  IF NOT coalesce(is_author,false) OR NEW.status<>'draft' OR NEW.response IS NOT NULL OR NEW.outcome IS NOT NULL OR NEW.official_reference IS NOT NULL THEN RAISE EXCEPTION 'Criação não autorizada' USING ERRCODE='check_violation'; END IF;
  NEW.revision:=1; NEW.created_at:=now(); NEW.sent_at:=NULL; NEW.reviewed_at:=NULL; NEW.responded_at:=NULL; NEW.completed_at:=NULL; NEW.criteria_snapshot:=NULL; NEW.shift_id:=NULL;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['justification','priority','evidence','status','response','outcome','official_reference','revision','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['justification','priority','evidence','status','response','outcome','official_reference','revision','updated_at']) THEN RAISE EXCEPTION 'Identidade/origem imutável' USING ERRCODE='check_violation'; END IF;
  is_recipient := sam_recipient(OLD);
  IF NOT (CASE OLD.status WHEN 'draft' THEN coalesce(is_author,false) AND NEW.status IN ('draft','sent','discarded')
   WHEN 'sent' THEN coalesce(is_recipient,false) AND NEW.status='in_review'
   WHEN 'in_review' THEN coalesce(is_recipient,false) AND NEW.status IN ('accepted','adjusted','declined')
   WHEN 'accepted' THEN coalesce(is_author,false) AND NEW.status='completed'
   WHEN 'adjusted' THEN coalesce(is_author,false) AND NEW.status='completed'
   WHEN 'declined' THEN coalesce(is_author,false) AND NEW.status='completed' ELSE false END)
   THEN RAISE EXCEPTION 'Transição/ator não permitido' USING ERRCODE='check_violation'; END IF;
  IF (OLD.status<>'draft' OR NEW.status<>'draft') AND (NEW.justification,NEW.priority,NEW.evidence) IS DISTINCT FROM (OLD.justification,OLD.priority,OLD.evidence) THEN RAISE EXCEPTION 'Conteúdo enviado imutável' USING ERRCODE='check_violation'; END IF;
  IF NEW.status NOT IN ('accepted','adjusted','declined') AND NEW.response IS DISTINCT FROM OLD.response THEN RAISE EXCEPTION 'Resposta imutável' USING ERRCODE='check_violation'; END IF;
  IF NEW.status<>'completed' AND (NEW.outcome,NEW.official_reference) IS DISTINCT FROM (OLD.outcome,OLD.official_reference) THEN RAISE EXCEPTION 'Desfecho só na conclusão' USING ERRCODE='check_violation'; END IF;
  NEW.revision:=OLD.revision+1;
 END IF;
 IF NEW.status='draft' THEN
  NEW.evidence:=sam_evidence(NEW.organization_id,NEW.patient_id,NEW.evidence);
  IF NEW.recipient_mode='specific' AND NOT EXISTS(SELECT 1 FROM memberships m JOIN care_assignments a ON a.organization_id=m.organization_id AND a.oidc_issuer=m.oidc_issuer AND a.oidc_sub=m.oidc_sub
    WHERE m.organization_id=NEW.organization_id AND m.role='physician' AND m.active AND a.active AND a.patient_id=NEW.patient_id AND m.oidc_issuer=NEW.recipient_issuer AND m.oidc_sub=NEW.recipient_sub)
    THEN RAISE EXCEPTION 'Médico sem vínculo ativo' USING ERRCODE='check_violation'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='draft' AND NEW.status='sent' THEN
  IF NOT EXISTS(SELECT 1 FROM patient_allocations a WHERE a.organization_id=NEW.organization_id AND a.patient_id=NEW.patient_id AND a.superseded_at IS NULL AND a.unit=NEW.unit) THEN RAISE EXCEPTION 'Alocação mudou; descarte e crie novo rascunho' USING ERRCODE='check_violation'; END IF;
  SELECT * INTO pc FROM request_priority_criteria WHERE organization_id=NEW.organization_id AND unit=NEW.unit AND priority=NEW.priority;
  IF NOT FOUND THEN RAISE EXCEPTION 'Critério de prioridade não configurado para esta unidade' USING ERRCODE='check_violation'; END IF;
  NEW.criteria_snapshot:=to_jsonb(pc)-'organization_id';
  IF NEW.recipient_mode='on_call' THEN
   SELECT count(*) INTO count_shifts FROM on_call_shifts s JOIN memberships m ON m.organization_id=s.organization_id AND m.oidc_issuer=s.physician_issuer AND m.oidc_sub=s.physician_sub AND m.role='physician' AND m.active
    WHERE s.organization_id=NEW.organization_id AND s.unit=NEW.unit AND s.starts_at<=now() AND s.ends_at>now();
   IF count_shifts<>1 THEN RAISE EXCEPTION 'Sem médico de plantão configurado para esta unidade ou escala ambígua' USING ERRCODE='check_violation'; END IF;
   SELECT s.* INTO chosen FROM on_call_shifts s JOIN memberships m ON m.organization_id=s.organization_id AND m.oidc_issuer=s.physician_issuer AND m.oidc_sub=s.physician_sub AND m.role='physician' AND m.active
    WHERE s.organization_id=NEW.organization_id AND s.unit=NEW.unit AND s.starts_at<=now() AND s.ends_at>now();
   NEW.recipient_issuer:=chosen.physician_issuer; NEW.recipient_sub:=chosen.physician_sub; NEW.shift_id:=chosen.id;
  ELSIF NOT EXISTS(SELECT 1 FROM memberships m JOIN care_assignments a ON a.organization_id=m.organization_id AND a.oidc_issuer=m.oidc_issuer AND a.oidc_sub=m.oidc_sub AND a.active
    WHERE m.organization_id=NEW.organization_id AND m.role='physician' AND m.active AND a.patient_id=NEW.patient_id AND m.oidc_issuer=NEW.recipient_issuer AND m.oidc_sub=NEW.recipient_sub)
    THEN RAISE EXCEPTION 'Médico sem vínculo ativo' USING ERRCODE='check_violation'; END IF;
  IF NEW.recipient_issuer=NEW.author_issuer AND NEW.recipient_sub=NEW.author_sub THEN RAISE EXCEPTION 'Destinatário deve ser outro profissional médico' USING ERRCODE='check_violation'; END IF;
  NEW.sent_at:=now();
 END IF;
 IF NEW.status='in_review' THEN NEW.reviewed_at:=now(); END IF;
 IF NEW.status IN ('accepted','adjusted','declined') THEN
  IF length(trim(coalesce(NEW.response,'')))<3 THEN RAISE EXCEPTION 'Resposta médica obrigatória' USING ERRCODE='check_violation'; END IF; NEW.responded_at:=now();
 END IF;
 IF NEW.status='completed' THEN
  IF length(trim(coalesce(NEW.outcome,'')))<3 OR length(trim(coalesce(NEW.official_reference,'')))<3 THEN RAISE EXCEPTION 'Desfecho e referência no sistema oficial obrigatórios' USING ERRCODE='check_violation'; END IF; NEW.completed_at:=now();
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER medical_request_guard BEFORE INSERT OR UPDATE ON medical_requests FOR EACH ROW EXECUTE FUNCTION sam_request_guard();
CREATE FUNCTION sam_request_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE act text; why text; role_name text;
BEGIN
 act:=CASE WHEN TG_OP='INSERT' THEN 'created' WHEN NEW.status=OLD.status THEN 'edited' ELSE NEW.status END;
 why:=CASE WHEN NEW.author_issuer=current_setting('app.sam_issuer',true) AND NEW.author_sub=current_setting('app.sam_sub',true) THEN 'author' WHEN NEW.recipient_mode='on_call' THEN 'on_call' ELSE 'linked' END;
 role_name:=CASE WHEN why='author' THEN NEW.author_role ELSE 'physician' END;
 INSERT INTO medical_request_events(organization_id,request_id,revision,action,actor_issuer,actor_sub,actor_role,access_reason,snapshot)
 VALUES(NEW.organization_id,NEW.id,NEW.revision,act,current_setting('app.sam_issuer',true),current_setting('app.sam_sub',true),role_name,why,to_jsonb(NEW)-'organization_id');
 INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type,metadata) VALUES(NEW.organization_id,current_setting('app.sam_issuer',true),current_setting('app.sam_sub',true),'medical_request.'||act,'medical_request',jsonb_build_object('request_id',NEW.id,'revision',NEW.revision,'actor_role',role_name,'access_reason',why));
 RETURN NEW;
END $$;
CREATE TRIGGER medical_request_history AFTER INSERT OR UPDATE ON medical_requests FOR EACH ROW EXECUTE FUNCTION sam_request_history();
CREATE TRIGGER medical_request_events_immutable BEFORE UPDATE OR DELETE ON medical_request_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
GRANT SELECT ON on_call_shifts,request_priority_criteria TO oncopharma_app;
GRANT SELECT,INSERT ON medical_requests,medical_request_events TO oncopharma_app;
GRANT UPDATE(justification,priority,evidence,status,response,outcome,official_reference) ON medical_requests TO oncopharma_app;
GRANT USAGE ON SEQUENCE medical_request_events_id_seq TO oncopharma_app;
-- Funções são SECURITY INVOKER e não aceitam promover privilégios.
REVOKE ALL ON FUNCTION sam_member(uuid,text[]),sam_link(uuid,uuid),sam_recipient(medical_requests),sam_access(medical_requests),sam_evidence(uuid,uuid,jsonb),sam_request_guard(),sam_request_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sam_member(uuid,text[]),sam_link(uuid,uuid),sam_recipient(medical_requests),sam_access(medical_requests),sam_evidence(uuid,uuid,jsonb),sam_request_guard(),sam_request_history() TO oncopharma_app;
COMMIT;
