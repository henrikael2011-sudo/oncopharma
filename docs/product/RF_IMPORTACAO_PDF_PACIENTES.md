# RF-UI-07 — Importação de relatório PDF de pacientes do dia

**Data:** 11/10/2026 • **Solicitante:** Henrikael Walisson • **Emenda:** *Emenda UI, 11/10/2026* (Plano Diretor v3 §2.3)
**Situação:** **Requisito aprovado; uso com dados reais pendente de autorização formal do hospital** (ver §4). Até lá, **somente PDFs sintéticos**.

## 1. Objetivo
Permitir que a farmácia carregue no ONCOPHARMA Clinical o relatório PDF de pacientes do dia exportado pelo sistema do hospital (Tasy, MV ou outro), para **piloto na farmácia antes da integração oficial** (D-007) e para gerar **evidência a apresentar à TI** do hospital.

## 2. Fluxo
1. **Upload** do PDF no Clinical (papel habilitado; MFA; vínculo com a instituição).
2. **Extração por layout configurável por fornecedor** (Tasy, MV, outro): perfis versionados que mapeiam campos (identificação, unidade, andar, quarto, leito, data de referência). Falha de reconhecimento de layout bloqueia a importação, sem gravação parcial.
3. **Pré-visualização obrigatória antes de gravar:** lista do que será **criado/atualizado** (paciente; unidade/andar/leito), campos não reconhecidos e linhas rejeitadas.
4. **Aviso de divergência** com dados existentes: dado **sincronizado** (integração oficial) prevalece; valores **manuais** ou de **PDF** divergentes são sinalizados para decisão humana; nada é sobrescrito silenciosamente.
5. **Confirmação humana** explícita (total ou por linha). Sem confirmação, nada é gravado.
6. **Origem exibida** em cada dado importado: "PDF importado", data/hora, quem importou, **hash SHA-256 do arquivo**, perfil de layout/versão.
7. **Auditoria** (`audit_events`): upload, pré-visualização, confirmação/rejeição, divergências e alterações gravadas.
8. **Arquivo original** guardado em storage **criptografado**, com **retenção definida** (prazo a aprovar pela instituição/DPO) e descarte auditado.

## 3. Critérios de aceite (com PDFs sintéticos)
- PDF sintético de cada layout configurado gera pré-visualização correta; nada é gravado antes da confirmação.
- Divergência com dado sincronizado é exibida e não sobrescreve o sincronizado.
- Origem e hash visíveis no paciente/leito; auditoria reconstrói quem, quando e o quê.
- Arquivo original armazenado criptografado e recuperável apenas por papel autorizado.
- Layout desconhecido → importação bloqueada com mensagem clara.

## 4. RESTRIÇÃO — dados reais de pacientes
Uso com dados reais **exige antes**:
1. **Autorização formal do hospital**: responsável da farmácia/direção **e** DPO/encarregado LGPD, com base legal de **tutela da saúde** (LGPD art. 11, II, "f") documentada.
2. **Ambiente de produção/homologação em AWS sa-east-1**, com acesso restrito (MFA, menor privilégio, logs).
3. **Repositório privado**; **nenhum dado real em DEV/teste ou ambiente público**.
4. Até lá: **somente PDFs sintéticos**.

## 5. Rastreabilidade
`docs/product/MATRIZ_RASTREABILIDADE.md` — UI-07 (ABERTO; dados reais BLOQUEADO até autorização do hospital/DPO). Diretriz: `docs/diretrizes-design.md` §7.
