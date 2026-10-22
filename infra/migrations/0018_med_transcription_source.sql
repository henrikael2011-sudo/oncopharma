-- M22 — origem da transcrição (rastreabilidade): manual, foto da prescrição (rascunho por IA/simulado) ou importação
-- do sistema hospitalar (simulado). Em TODOS os casos a entrada nasce pendente e só a farmácia libera. Somente DEV.
DO $$ BEGIN IF current_database() <> 'oncopharma_dev' THEN RAISE EXCEPTION 'Somente oncopharma_dev'; END IF; END $$;
BEGIN;
ALTER TABLE clinical_med_transcriptions ADD COLUMN IF NOT EXISTS entry_source text NOT NULL DEFAULT 'manual' CHECK (entry_source IN ('manual','foto_ia','hospital'));
ALTER TABLE clinical_med_transcriptions ADD COLUMN IF NOT EXISTS source_detail text CHECK (source_detail IS NULL OR char_length(source_detail) <= 160);
COMMIT;
