# Referência — Bulas Anvisa e protocolos de quimioterápicos (ONCOPHARMA)

> ⚠️ **AVISO:** documento de referência para **conferência auxiliar**. **Não é protocolo validado.** Não substitui prescrição médica, bula vigente ou rotina institucional. **Requer validação de Henrikael (farmacêutico responsável)** antes de qualquer uso. Nada aqui foi inferido: campos sem fonte estão marcados "não consta na fonte" ou "pendente".

## 1. Bulas Anvisa — em coleta

Placeholder: coleta das bulas profissionais (Bulário Eletrônico Anvisa) em andamento por outro fluxo. PDFs já disponíveis no momento deste commit: fluoruracila (Bergamo), oxaliplatina, irinotecano e capecitabina (Eurofarma) — usados na Seção 3. Protocolos por esquema: ver `PROTOCOLOS_ONCOLOGICOS_REFERENCIA.md`.

## 2. Protocolos brasileiros de referência (fontes públicas)

> ⚠️ **AVISO:** material de referência para **conferência auxiliar**. **Não é um protocolo validado** e não substitui a prescrição médica, a bula vigente nem as rotinas da instituição. **Toda informação precisa ser validada por Henrikael (farmacêutico responsável)** antes de qualquer uso no produto. Só foi registrado o que a fonte diz; "não consta na fonte" = a fonte consultada não traz o dado. Coleta: 21/10/2026 (horário de Brasília).

### 2.1 Fontes consultadas

| Fonte | Situação | URL |
|---|---|---|
| MS — PCDT Câncer de Mama (Portaria Conjunta SAES/SECTICS nº 17, 25/11/2024) | ✅ baixado (Apêndice 2, p.100–101 do PDF) | https://www.gov.br/saude/pt-br/assuntos/pcdt/c/cancer-de-mama |
| MS — PCDT Linfoma Difuso de Grandes Células B (Portaria SAS nº 956, 26/09/2014) | ✅ baixado (item 6.1, p.8) | https://www.gov.br/saude/pt-br/assuntos/pcdt/l/linfoma-difuso-de-grandes-celulas-b |
| MS — PCDT Linfoma de Hodgkin no Adulto (Portaria Conjunta nº 24, 29/12/2020) | ✅ baixado (Figura 1, p.15 — doses em imagem, transcritas por leitura visual) | https://www.gov.br/saude/pt-br/assuntos/pcdt/l/linfoma-de-hodgkin-no-adulto |
| MS — DDT Tumor Cerebral no Adulto (Portaria Conjunta nº 7, 13/04/2020) | ✅ baixado (p.15) | https://www.gov.br/saude/pt-br/assuntos/pcdt/t/tumor-cerebral-no-adulto-ddt |
| MS — PCDT Adenocarcinoma de Cólon e Reto (Portaria Conjunta SAES/SCTIE nº 25, 17/11/2025) | ✅ baixado — lista esquemas **sem doses** (p.12–14) | https://www.gov.br/saude/pt-br/assuntos/pcdt/a/adenocarcinoma-de-colon-e-de-reto |
| MS — DDT Câncer de Pulmão (Portaria SAS nº 957, 26/09/2014) | ✅ baixado — cita esquemas **sem doses** (p.11) | https://www.gov.br/saude/pt-br/assuntos/pcdt/c/cancer-de-pulmao |
| MS — DDT Adenocarcinoma de Estômago (2018), Carcinoma de Esôfago (2014), Câncer de Cabeça e Pescoço (2015) | ✅ baixados — doses só em tabelas de evidência de estudos (não transcritas como protocolo) | gov.br/saude/pt-br/assuntos/pcdt (letras a, c) |
| Conitec — página de PCDT/DDT | ⚠️ página `.../ddt` retornou 404/página de erro; usados os PDFs do gov.br/saude | https://www.gov.br/conitec/pt-br/protocolos-clinicos-e-diretrizes-terapeuticas |
| SBOC — Diretrizes de Tratamentos Oncológicos | ❌ sem resposta (timeout) do box; não coletado — consultar diretamente | https://diretrizes.sboc.org.br/ |
| SOBRAFO | ⚠️ site responde (200); nenhum guia público de preparo/administração localizado nesta coleta | https://sobrafo.org.br/ |
| INCA (rotinas/publicações) | ⏳ não coletado nesta rodada — pendente | https://www.gov.br/inca |
| **Hospital Israelita Albert Einstein** — Guia/Manual Farmacêutico e Guias/Protocolos (Medical Suite) | ❌ **HTTP 403** em `medicalsuite.einstein.br/pratica-medica/...` e no PDF antigo `medicalsuite.einstein.br/diretrizes/farmacia/ManualFarm11.pdf` (Manual Farmacêutico 2011/2012, 14ª ed., Schvartsman C., Salomão D. et al. — citado em fontes secundárias). Portal Medical Suite é voltado ao corpo clínico (login). **Fonte a consultar diretamente**: requer acesso autorizado do Medical Suite ou cópia institucional/edição impressa atual. Nenhum dado Einstein foi transcrito. | https://medicalsuite.einstein.br/ |
| Rotinas internas de clínicas | ❌ não públicas — não disponíveis | — |

Não foi contornado nenhum login, captcha ou paywall.

### 2.2 Esquemas com doses na fonte pública

Campos não informados nas fontes (salvo quando indicado): **ordem de infusão, tempo de infusão, diluição e estabilidade — não consta na fonte**.

| # | Esquema | Indicação (fonte) | Fármacos / dose / via / dias | Intervalo / nº ciclos | Citação |
|---|---|---|---|---|---|
| 1 | T (paclitaxel semanal) | Câncer de mama | Paclitaxel 80 mg/m² semanal; via não consta | 12 semanas | PCDT Mama 2024, Apêndice 2, p.100 |
| 2 | Tdd | Câncer de mama | Paclitaxel 175 mg/m² + G-CSF quando disponível | 14 dias, 4 ciclos | idem |
| 3 | TC/CT | Câncer de mama | Docetaxel 75 mg/m² + ciclofosfamida 600 mg/m² | 21 dias, 4–6 ciclos | idem |
| 4 | AC | Câncer de mama | Doxorrubicina 60 mg/m² + ciclofosfamida 600 mg/m² | 21 dias ×4 ou 14 dias c/ G-CSF | idem |
| 5 | AC-T | Câncer de mama | AC como acima → docetaxel 100 mg/m² q21d ×4 OU paclitaxel 175 mg/m² q14d ×4 OU paclitaxel 80 mg/m² semanal ×12. Fonte: "paclitaxel 175 mg/m² a cada 3 semanas é inferior ao esquema de 80 mg/m² semanal" | ver fármacos | idem |
| 6 | AC-T dose-densa (pacli q2s / semanal) / ACdd→T | Câncer de mama | AC q14d ×4 + filgrastim 300 mcg (SC) D3–D10 → paclitaxel 175 mg/m² IV D1 q14d ×4 ou 80 mg/m² IV semanal ×12 | 14 dias | idem, p.100–101 |
| 7 | CMF | Câncer de mama | Ciclofosfamida 100 mg/m² D1–D14 + metotrexato 40 mg/m² D1,D8 + 5-FU 600 mg/m² D1,D8 | 28 dias, 6 ciclos | idem |
| 8 | FAC | Câncer de mama | Doxorrubicina 50 + ciclofosfamida 500 + fluoruracila 500 mg/m² IV D1 | 21 dias, 6 ciclos | idem |
| 9 | FEC | Câncer de mama | Ciclofosfamida 500 + fluoruracila 500 mg/m² "D1 e D4" + epirrubicina 75 mg/m² IV D1 (transcrito como na fonte) | 21 dias, 4 ciclos | idem |
| 10 | EC | Câncer de mama | Epirrubicina 90 + ciclofosfamida 600 mg/m² | 21 dias, 4 ciclos | idem |
| 11 | TAC | Câncer de mama | Doxorrubicina 50 + docetaxel 75 + ciclofosfamida 500 mg/m²; filgrastim 300 mcg SC D2–D14; ciprofloxacino 500 mg VO 12/12h D5–D14 | 21 dias, 6 ciclos | idem |
| 12 | TCH | Câncer de mama HER2+ | Docetaxel 75 mg/m² + carboplatina AUC 6 + trastuzumabe 8 mg/kg IV em 1 h (ataque), depois 6 mg/kg IV em 30 min | 21 dias, 6 ciclos; trastuzumabe até 1 ano | idem, p.101 |
| 13 | CaT | Câncer de mama | Paclitaxel 80 mg/m² + carboplatina AUC 2 semanal | 12 semanas | idem |
| 14 | PCb | Câncer de mama | Paclitaxel 80 mg/m² D1,D8,D15 + carboplatina AUC 2 D1,D8,D15 | 28 dias, 6 ciclos | idem |
| 15 | Capecitabina | Câncer de mama | 1.000–1.250 mg/m² VO 2×/dia D1–D14 | 21 dias, 6–8 ciclos | idem |
| 16 | Docetaxel (c/ pertuzumabe+trastuzumabe) | Câncer de mama HER2+ | Docetaxel 75 mg/m² q3s ×4–6; pertuzumabe 840 mg IV → 420 mg q3s; trastuzumabe 4→2 mg/kg semanal ou 8→6 mg/kg q3s | 21 dias | idem |
| 17 | CHOP(-21) | LDGCB | Ciclofosfamida 750 mg/m² EV D1; doxorrubicina 50 mg/m² EV D1; vincristina 1,4 mg/m² (máx. 2 mg) EV D1; prednisona 40 mg/m² VO D1–D5. Fonte: pode ser substituído por CHOP-14 | 21 dias, 6 (até 8) ciclos | PCDT LDGCB 2014, item 6.1.1, p.8 |
| 18 | R-CHOP | LDGCB CD20+ | CHOP + rituximabe 375 mg/m² EV D1 **"antes dos demais quimioterápicos"** (única ordem de infusão explícita encontrada) | 21 dias, 6–8 ciclos | idem, 6.1.2, p.8 |
| 19 | ABVD | Linfoma de Hodgkin | Doxorrubicina 25 mg/m² D1,D15 IV; bleomicina 10 UI/m² D1,D15 IV; vimblastina 6 mg/m² D1,D15 IV; dacarbazina 375 mg/m² D1,D15 IV | 28 dias | PCDT LH 2020, Figura 1, p.15 |
| 20 | BEACOPP padrão | Linfoma de Hodgkin | Bleomicina 10 UI/m² D8 IV; etoposídeo 100 mg/m² D1–D3 IV; doxorrubicina 25 mg/m² D1 IV; ciclofosfamida 650 mg/m² D1 IV; vincristina 1,4 mg/m² D8 IV (máx. 2 mg); procarbazina 100 mg/m² D1–D7 VO; prednisona 40 mg/m² D1–D14 VO; G-CSF a partir de D8 SC | 21 dias | idem |
| 21 | BEACOPP escalonado | Linfoma de Hodgkin | Igual ao padrão, mas etoposídeo 200 mg/m² D1–D3, doxorrubicina 35 mg/m² D1, ciclofosfamida 1.250 mg/m² D1 | 21 dias | idem |
| 22 | Temozolomida + RT (Stupp) | Glioblastoma/glioma alto grau | Temozolomida 75 mg/m² concomitante à RT; 200 mg/m² adjuvante "5 dias na semana durante 6 meses" (descrito como estudos comparados, sem posologia completa) | não consta | DDT Tumor Cerebral 2020, p.15 |
| 23 | PCV | Glioma | Procarbazina 60 mg/m², lomustina 110 mg/m², vincristina 1,4 mg/m² pós-RT (descrição de estudo) | "semanas cada ciclo" — incompleto na fonte | idem, p.14–15 |

### 2.3 Esquemas citados na fonte pública **sem doses**

| Esquema | Fonte | Observação |
|---|---|---|
| FOLFOX / mFOLFOX6 (5-FU + ácido folínico + oxaliplatina) | PCDT Cólon e Reto 2025, p.12–14 | doses: não consta na fonte. Bula de fluoruracila (Bergamo) descreve FOLFOX6 de estudo — ver seção 3 |
| CAPOX/XELOX (capecitabina + oxaliplatina) | idem | não consta |
| FOLFIRI, FOLFIRINOX, IROX (irinotecano + oxaliplatina) | idem | não consta |
| Cisplatina/carboplatina + etoposídeo; carboplatina + paclitaxel; gencitabina, docetaxel, vinorelbina (paliativo) | DDT Pulmão 2014, p.11 | não consta |
| BEP, cisplatina + gencitabina | — | nenhuma fonte pública MS coletada nesta rodada (pendente) |

**Contagem:** 23 esquemas com dose em fonte pública + 9 esquemas listados sem dose.

## 3. Cruzamento bula × protocolo — cards por fármaco

Legenda da linha **Divergência**: ✅ bate · ⚠️ diverge · — sem dado. "pendente" = fonte ainda não coletada.
Coluna **Guia Farmacêutico Einstein**: fonte **inacessível** nesta coleta (HTTP 403, Medical Suite restrito) → *pendente — consultar diretamente*.
Bulas usadas (PDFs em `/workspace/audit-oncopharma/bulas/`, extraídos com `pdftotext`):
- **[B-5FU]** Fluoruracila 500 mg/20 mL, Lab. Químico Farmacêutico Bergamo Ltda., bula profissional, Bula Padrão aprovada pela Anvisa em 24/06/2014.
- **[B-OXA]** Oxaliplatina 50 e 100 mg pó liofilizado, Eurofarma Laboratórios S.A., bula profissional, Bula Padrão aprovada pela Anvisa em 07/04/2026.
- **[B-IRI]** Cloridrato de irinotecano tri-hidratado 20 mg/mL (genérico), Eurofarma Laboratórios S.A., bula profissional, Bula Padrão aprovada pela Anvisa em 13/11/2025.
- **[B-CAP]** Capecitabina 150/500 mg comprimidos revestidos, Eurofarma Laboratórios S.A., bula profissional, Bula Padrão aprovada pela Anvisa em 13/11/2025.

### 3.1 Fluoruracila (5-FU)

| Campo | Bula Anvisa | Guia Farmacêutico Einstein |
|---|---|---|
| Dose | 12 mg/kg/dia (máx. 800 mg/dia) por 3–4 dias; depois 6 mg/kg em 4 dias alternados; manutenção 5–15 mg/kg semanal [B-5FU p.8]. Esquemas de estudo citados: FOLFOX6 bolus 400 mg/m² + 2,4–3,0 g/m² em 46 h; FOLFIRI 400 mg/m² bolus + infusão 46 h [B-5FU p.3] | pendente |
| Diluição | Infusão: diluir em 300–500 mL de SG 5% ou SF 0,9% (este "especialmente no caso de pacientes diabéticos") [B-5FU p.8] | pendente |
| Via | Exclusivamente intravenosa, injeção ou infusão [B-5FU p.8] | pendente |
| Estabilidade da bolsa (solução pronta p/ infusão) | 8 h em SF 0,9%; 48 h em SG 5% (temperatura e luz da solução diluída: não consta) [B-5FU p.8] | pendente |
| Estabilidade do frasco após aberto / overfill residual | Não consta na bula (consta apenas armazenamento do frasco fechado: 15–30 °C, proteger da luz; se houver precipitado, aquecer até 60 °C e agitar) [B-5FU p.7–8] | pendente |
| Ordem / tempo de infusão | Na bula só como descrição de estudos: FOLFOX6 — oxaliplatina e ácido folínico em 2 h no D1, depois 5-FU bolus + 46 h [B-5FU p.3] | pendente |
| Protocolo MS | Mama (CMF 600 mg/m² D1,D8 q28d; FAC/FEC 500 mg/m²) [PCDT Mama 2024, Ap.2 p.100]; colorretal sem dose [PCDT CCR 2025 p.12–14] | — |
| **Divergência** | — sem dado (Einstein pendente). Obs.: bula expressa dose principal em mg/kg; PCDT Mama em mg/m² — unidades diferentes, não comparável sem validação | — |

### 3.2 Oxaliplatina

| Campo | Bula Anvisa | Guia Farmacêutico Einstein |
|---|---|---|
| Dose | 85 mg/m² IV a cada 2 semanas c/ fluoropirimidinas (CCR metastático/adjuvante, 12 ciclos); 130 mg/m² (monoterapia ou c/ capecitabina ± bevacizumabe) [B-OXA p.7] | pendente |
| Diluição | Reconstituir com água para injetáveis ou glicose 5%; diluir em 250–500 mL de glicose 5%; concentração não menor que 0,2 mg/mL; **nunca** usar solução salina/soluções com cloreto [B-OXA p.7–8] | pendente |
| Via | Infusão IV [B-OXA p.7] | pendente |
| Estabilidade da bolsa (solução pronta p/ infusão) | Diluída em glicose 5%: 48 h em 2–8 °C; até 24 h em 15–30 °C (luz da solução diluída: não consta) [B-OXA p.7] | pendente |
| Estabilidade do frasco após aberto / overfill residual | Reconstituída (água ou glicose 5%): até 48 h em 2–8 °C; descartar o não utilizado após 48 h. Frasco fechado: 15–30 °C, proteger da luz e umidade [B-OXA p.7] | pendente |
| Ordem / tempo de infusão | 2 a 6 h [B-OXA p.7]; se reação laríngea após infusão de 2 h, próxima em 6 h [B-OXA]; não misturar nem administrar simultaneamente na mesma linha; incompatível com 5-FU/soluções básicas na mesma bolsa. FOLFOX4 (estudo): oxaliplatina 85 mg/m² em 2 h + AF 200 mg/m² em 2 h, seguido de 5-FU [B-OXA p.2–3] | pendente |
| Protocolo MS | PCDT CCR 2025 cita FOLFOX/CAPOX/IROX/FOLFIRINOX **sem doses** [p.12–14] | — |
| **Divergência** | — sem dado (PCDT sem dose; Einstein pendente) | — |

### 3.3 Irinotecano

| Campo | Bula Anvisa | Guia Farmacêutico Einstein |
|---|---|---|
| Dose | Agente único semanal 125 mg/m² (100 mg/m² em condições de risco), 4 semanas + 2 de descanso, ajuste 50–150 mg/m²; a cada 2 semanas 250 mg/m² (200 mg/m² em risco) [B-IRI p.14]. Combinação c/ 5-FU/folinato: 125 mg/m² + 5-FU 500 mg/m² + folinato 20 mg/m² semanal ×4, ciclo 6 semanas; c/ cisplatina 65 mg/m² + cisplatina 30 mg/m² [B-IRI p.15] | consultar diretamente |
| Diluição | SG 5% (preferência) ou SF 0,9%, concentração final 0,12–2,8 mg/mL; não adicionar outros fármacos [B-IRI p.14] | consultar diretamente |
| Via | Infusão IV [B-IRI p.14] | consultar diretamente |
| Estabilidade da bolsa | 24 h a 15–30 °C sob luz fluorescente (SF ou SG); SG 5% refrigerado 2–8 °C protegido da luz: 48 h; SF não deve ser refrigerado; por risco microbiológico usar em 24 h refrigerado ou 6 h em temperatura ambiente [B-IRI p.13–14] | consultar diretamente |
| Estabilidade do frasco após aberto / overfill residual | Não consta na bula (frasco fechado: 15–30 °C, proteger da luz, não congelar) [B-IRI p.13] | consultar diretamente |
| Ordem / tempo de infusão | 30–90 min [B-IRI p.14]; folinato imediatamente após irinotecano, 5-FU imediatamente após folinato [B-IRI p.15] | consultar diretamente |
| Protocolo | PCDT CCR 2025 sem dose; FOLFIRI 180 mg/m² em fonte alternativa — ver `PROTOCOLOS_ONCOLOGICOS_REFERENCIA.md` §4.3 | — |
| **Divergência** | ⚠️ FOLFIRI 180 mg/m² q14d (fonte alternativa) ≠ esquema de combinação da bula (125 mg/m² semanal) | — |

### 3.4 Capecitabina

| Campo | Bula Anvisa | Guia Farmacêutico Einstein |
|---|---|---|
| Dose | Monoterapia (mama, colorretal) 1.250 mg/m² 2×/dia ×14 dias + 7 dias de pausa; combinação 800–1.000 mg/m² 2×/dia ×2 semanas + 7 dias pausa, ou 625 mg/m² 2×/dia contínuo; c/ docetaxel 1.250 mg/m² 2×/dia [B-CAP p.16] | consultar diretamente |
| Diluição | Não se aplica (VO) | — |
| Via | Oral, comprimidos inteiros com água, até 30 min após refeições; não partir, abrir ou mastigar [B-CAP p.16] | consultar diretamente |
| Estabilidade | Temperatura ambiente 15–30 °C; validade 24 meses [B-CAP p.16] | consultar diretamente |
| Protocolo MS | Mama: 1.000–1.250 mg/m² 2×/dia D1–D14 q21d ×6–8 [PCDT Mama 2024 Ap.2] | — |
| **Divergência** | ✅ confere com PCDT Mama e CAPOX (2.000 mg/m²/dia); ⚠️ trituração por sonda (fonte alternativa) vs "não partir" da bula | — |

### 3.5 Demais fármacos em escopo — cards pendentes

Para cada um: Bula Anvisa = **pendente** (PDF ainda não presente em `bulas/` em 21/10/2026); Einstein = **consultar diretamente**; dose MS disponível na seção 2.2 quando houver.

| Fármaco | Dose MS na seção 2 | Bula | Einstein | Divergência |
|---|---|---|---|---|
| Ácido folínico | não consta | pendente | pendente | — |
| Doxorrubicina | #4–8, 11, 17–21 | pendente | pendente | — |
| Epirrubicina | #9, 10 | pendente | pendente | — |
| Ciclofosfamida | #3–11, 17, 20–21 | pendente | pendente | — |
| Paclitaxel | #1, 2, 5, 6, 13, 14 | pendente | pendente | — |
| Docetaxel | #3, 5, 11, 12, 16 | pendente | pendente | — |
| Carboplatina | #12–14 | pendente | pendente | — |
| Cisplatina | não consta | pendente | pendente | — |
| Gencitabina | não consta | pendente | pendente | — |
| Etoposídeo | #20–21 | pendente | pendente | — |
| Bleomicina | #19–21 | pendente | pendente | — |
| Vincristina | #17, 20–21, 23 | pendente | pendente | — |
| Vimblastina / Dacarbazina | #19 | pendente | pendente | — |
| Metotrexato | #7 | pendente | pendente | — |
| Temozolomida | #22 | pendente | pendente | — |
