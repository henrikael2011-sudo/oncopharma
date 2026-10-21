# Protocolos oncológicos — referência (ONCOPHARMA)

> ⚠️ **REFERÊNCIA PARA DEMONSTRAÇÃO — NÃO É LIBERAÇÃO CLÍNICA.** Este documento organiza o que fontes públicas dizem sobre esquemas quimioterápicos, para demonstrar a conferência automática do produto. **Não substitui prescrição médica, bula vigente nem protocolo institucional. Toda informação exige validação pelo farmacêutico responsável (Henrikael Walisson) antes de qualquer uso.** Nada foi inferido: campo sem dado na fonte = **"não consta na fonte"**.
>
> **Premissa do produto:** a clínica usa o **protocolo completo da fonte, sem customização local** — o produto compara a prescrição contra o protocolo tal como publicado na fonte citada.
>
> Coleta: 21/10/2026 (horário de Brasília, UTC-3).

## 1. Fontes e tipo

Tipo: **oficial** = Anvisa (bula), Ministério da Saúde (PCDT/DDT/RENAME), INCA, rede pública federal (EBSERH); **alternativa** = hospital/sociedade/fabricante fora do MS.

| Sigla | Fonte | Tipo | Situação | URL / arquivo |
|---|---|---|---|---|
| [PCDT-MAMA] | MS — PCDT Câncer de Mama (Portaria Conjunta SAES/SECTICS nº 17/2024), Apêndice 2, p.100–101 | oficial | ✅ | https://www.gov.br/saude/pt-br/assuntos/pcdt/c/cancer-de-mama |
| [PCDT-LDGCB] | MS — PCDT Linfoma Difuso de Grandes Células B (Portaria SAS nº 956/2014), item 6.1, p.8 | oficial | ✅ | https://www.gov.br/saude/pt-br/assuntos/pcdt/l/linfoma-difuso-de-grandes-celulas-b |
| [PCDT-LH] | MS — PCDT Linfoma de Hodgkin no Adulto (Portaria Conjunta nº 24/2020), Figura 1, p.15 | oficial | ✅ | https://www.gov.br/saude/pt-br/assuntos/pcdt/l/linfoma-de-hodgkin-no-adulto |
| [DDT-SNC] | MS — DDT Tumor Cerebral no Adulto (Portaria Conjunta nº 7/2020), p.14–15 | oficial | ✅ | https://www.gov.br/saude/pt-br/assuntos/pcdt/t/tumor-cerebral-no-adulto-ddt |
| [PCDT-CCR] | MS — PCDT Adenocarcinoma de Cólon e Reto (Portaria Conjunta nº 25/2025), p.12–14 | oficial | ✅ cita esquemas **sem dose** | https://www.gov.br/saude/pt-br/assuntos/pcdt/a/adenocarcinoma-de-colon-e-de-reto |
| [DDT-PULM] | MS — DDT Câncer de Pulmão (Portaria SAS nº 957/2014), p.11 | oficial | ✅ cita esquemas **sem dose** | https://www.gov.br/saude/pt-br/assuntos/pcdt/c/cancer-de-pulmao |
| [DDT-EST/ESO/CP] | MS — DDT Estômago (2018), Esôfago (2014), Cabeça e Pescoço (2015) | oficial | ✅ doses só em tabelas de estudos (não transcritas) | https://www.gov.br/saude/pt-br/assuntos/pcdt |
| [RENAME] | MS — RENAME 2024, grupo L (p.83 em diante) | oficial | ✅ baixado; lista só ciclofosfamida 50 mg comp., hidroxiureia e rituximabe no Componente Especializado — **antineoplásicos oncológicos não estão na RENAME** (financiados via APAC/CACON-UNACON) | https://bvsms.saude.gov.br/bvs/publicacoes/relacao_nacional_medicamentos_2024.pdf |
| [HC-UFTM] | EBSERH/HC-UFTM — Protocolo PRT.HCUFTM.CPAM.002 "Uso Seguro de Quimioterápicos Antineoplásicos" v3 (tabela por fármaco: via, diluente, tempo de infusão), p.13–27 | oficial (rede pública federal) | ✅ | https://www.gov.br/hubrasil/pt-br/hospitais-universitarios/regiao-sudeste/hc-uftm/documentos/protocolos-assistenciais/PRT.HCUFTMCPAM.002UsoSegurodeQuimioterapicosAntineoplasicosversao3.pdf |
| [EG-n] | Hospital Erasto Gaertner (Curitiba) — Guia Farmacoterapêutico, Protocolos de antineoplásicos, página nº n (seções "Esquema", "Intervalo entre os ciclos", "Recomendações") | **alternativa** | ✅ público | https://guiafarmaco.erastogaertner.com.br/antineoplasicos/protocolos/<n> |
| [B-5FU] | Bula profissional fluoruracila 500 mg/20 mL — Bergamo (Bula Padrão Anvisa 24/06/2014) | oficial | ✅ | `/workspace/audit-oncopharma/bulas/fluoruracila.pdf` |
| [B-OXA] | Bula profissional oxaliplatina 50/100 mg — Eurofarma (Bula Padrão Anvisa 07/04/2026) | oficial | ✅ | `bulas/oxaliplatina.pdf` |
| [B-IRI] | Bula profissional cloridrato de irinotecano 20 mg/mL — Eurofarma, genérico (Bula Padrão Anvisa 13/11/2025) | oficial | ✅ | `bulas/irinotecano.pdf` |
| [B-CAP] | Bula profissional capecitabina 150/500 mg — Eurofarma (Bula Padrão Anvisa 13/11/2025) | oficial | ✅ | `bulas/capecitabina.pdf` |
| Einstein | Guia Farmacêutico / Guia de Oncologia Einstein (Medical Suite) | alternativa | ❌ **consultar diretamente** (HTTP 403 / acesso de corpo clínico). Nenhum dado Einstein transcrito. | https://medicalsuite.einstein.br/ |

## 2. Esquemas — campo a campo

Legenda de fonte por campo entre colchetes. EVI = endovenoso infusão; EVB = bolus; EVC = contínuo. "nc" = **não consta na fonte**.
Observação geral: os PCDT/DDT do MS **não trazem diluente, volume, tempo de infusão, estabilidade nem ordem de infusão** (exceto rituximabe "antes dos demais" no R-CHOP [PCDT-LDGCB p.8]). Esses campos vêm de [EG] (alternativa) e/ou [HC-UFTM]; estabilidade de bolsa só vem de bula.

### 2.1 FOLFOX (mFOLFOX6) — [EG-72]
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer colorretal; carcinoma gastroesofágico | [EG-72] Indicações; MS cita FOLFOX sem dose [PCDT-CCR p.12–14] |
| Fármacos/dose/via | Oxaliplatina 85 mg/m² EVI D1,D15; folinato de cálcio 400 mg/m² EVI D1,D15; fluoruracila 400 mg/m² EVB D1,D15 + 2.400 mg/m² EVC 46 h D1,D15 | [EG-72] Esquema |
| Diluente/volume | Oxaliplatina em G5% 500 mL; folinato em G5% 250 mL; 5-FU bolus: nc; 5-FU 46 h: nc (regime internado: 1.200 mg/m² D1 e D2 em SF 0,9% 1.000 mL, 23 h cada) | [EG-72] |
| Tempo de infusão | Oxali 120 min; folinato 120 min; 5-FU bolus 5 min; 5-FU contínuo 46 h | [EG-72] |
| Ordem | Numeração: (hidratação/pré) → oxaliplatina → folinato → 5-FU bolus → 5-FU contínuo; "oxaliplatina pode ser infundida em Y com folinato de cálcio, ambos em G5%" | [EG-72] Esquema/Recomendações |
| Estabilidade da bolsa | nc no protocolo (ver bula, seção 4) | — |
| Ciclo | "28 dias" com D1 e D15 (= administração a cada 14 dias) | [EG-72] Intervalo |
| FOLFOX-4 (mesma página) | Oxali 85 mg/m² G5% 500 mL 120 min D1; folinato 200 mg/m² G5% 250 mL 120 min D1–D2; 5-FU 400 mg/m² EVB D1; 5-FU 600 mg/m² EVC 22 h D1–D2 | [EG-72] |

### 2.2 FOLFIRI — [EG-69]
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer colorretal | [EG-69]; MS cita sem dose [PCDT-CCR p.12–14] |
| Fármacos/dose/via | Irinotecano 180 mg/m² EVI D1; folinato 400 mg/m² EVI D1; 5-FU 400 mg/m² EVB D1; 5-FU 2.400 mg/m² EVC 46 h D1 | [EG-69] |
| Diluente/volume | Irinotecano G5% 500 mL; folinato G5% 250 mL; 5-FU bolus volume do medicamento puro; 5-FU 46 h qsp 98 mL SF 0,9% | [EG-69] |
| Tempo | Irinotecano 90 min; folinato 120 min; bolus 5 min; contínuo 46 h | [EG-69] |
| Ordem | Pré (escopolamina 20 mg EVB) → irinotecano → folinato → 5-FU bolus → 5-FU contínuo; "irinotecano pode ser infundido em Y com folinato" | [EG-69] |
| Estabilidade | nc no protocolo | — |
| Ciclo | 14 dias | [EG-69] |

### 2.3 CAPOX (XELOX) — [EG-116]
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer colorretal; adenocarcinoma gástrico | [EG-116]; MS sem dose [PCDT-CCR] |
| Fármacos/dose/via | Oxaliplatina 130 mg/m² EVI D1; capecitabina 2.000 mg/m²/dia VO D1–D14, dividida 12/12 h, 30 min após refeição | [EG-116] |
| Diluente/volume | Oxaliplatina G5% 500 mL; capecitabina: não se aplica (VO) | [EG-116] |
| Tempo | Oxaliplatina 120 min | [EG-116] |
| Ordem | nc (apenas um fármaco IV) | — |
| Estabilidade | nc | — |
| Ciclo | 21 dias, 8 ciclos | [EG-116] |

### 2.4 AC (doxorrubicina + ciclofosfamida)
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer de mama | [PCDT-MAMA Ap.2 p.100]; [EG-14] |
| Dose | Doxorrubicina 60 mg/m² + ciclofosfamida 600 mg/m² | [PCDT-MAMA p.100] (oficial); [EG-14] confere |
| Via | Doxorrubicina EVB; ciclofosfamida EVI | [EG-14]; PCDT: nc |
| Diluente/volume | Doxorrubicina: nc (bolus); ciclofosfamida SF 0,9% 250 mL | [EG-14] |
| Tempo | Doxorrubicina 5 min; ciclofosfamida 20 min | [EG-14] |
| Ordem | [EG-14]: doxorrubicina → ciclofosfamida. **Atenção:** [EG-16] (AC-T docetaxel) lista ciclofosfamida → doxorrubicina — a própria fonte alternativa não é uniforme | [EG-14], [EG-16] |
| Estabilidade | nc | — |
| Ciclo | 21 dias ×4, ou 14 dias com G-CSF (dose densa) [PCDT-MAMA]; [EG-14] 21 dias; [EG-248] AC dose densa 14 dias ×4, filgrastim 7 dias | ambos |

### 2.5 AC-T (paclitaxel / docetaxel)
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer de mama | [PCDT-MAMA p.100–101]; [EG-15], [EG-16] |
| Dose | AC ×4 → paclitaxel 80 mg/m² semanal ×12 **ou** 175 mg/m² q14d ×4 (dose densa c/ filgrastim) **ou** docetaxel 100 mg/m² q21d ×4 | [PCDT-MAMA] |
| Dose (alternativa) | Paclitaxel 80 mg/m² D1,D8,D15 ou 175 mg/m² D1 [EG-15]; docetaxel 75–100 mg/m² D1 [EG-16] | [EG] |
| Diluente/volume | Paclitaxel SF 0,9% 500 mL; docetaxel SF 0,9% 500 mL; materiais livres de PVC | [EG-15], [EG-16], [EG-105] |
| Tempo | Paclitaxel 60 min; docetaxel 60 min | [EG-15], [EG-16] |
| Via | IV (paclitaxel "IV" em dose densa) | [PCDT-MAMA p.101] |
| Ordem | AC completo (4 ciclos) antes da fase T | [PCDT-MAMA]; [EG-15] |
| Estabilidade | nc | — |
| Ciclo | T semanal 12 sem.; T q14d ×4; docetaxel q21d ×4 [PCDT-MAMA]; [EG-15] 21 dias | ambos |

### 2.6 TC (docetaxel + ciclofosfamida)
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Câncer de mama | [PCDT-MAMA p.100]; [EG-105] |
| Dose | Docetaxel 75 mg/m² + ciclofosfamida 600 mg/m² | [PCDT-MAMA] = [EG-105] |
| Diluente/volume | Docetaxel SF 0,9% 500 mL (bolsa livre de PVC); ciclofosfamida SF 0,9% 250 mL | [EG-105] |
| Tempo | Docetaxel 60 min; ciclofosfamida 20 min | [EG-105] |
| Via | EVI | [EG-105] |
| Ordem | Docetaxel → ciclofosfamida (numeração da fonte) | [EG-105] |
| Estabilidade | nc | — |
| Ciclo | 21 dias, 4–6 ciclos [PCDT-MAMA]; 21 dias ×4 [EG-105] | ambos |

### 2.7 Carboplatina + paclitaxel
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Mama (CaT/PCb) [PCDT-MAMA]; pulmão cita sem dose [DDT-PULM p.11]; [EG-30]: CPNPC, ovário, mama, anal | — |
| Dose oficial | Paclitaxel 80 mg/m² + carboplatina AUC 2 semanal ×12 (CaT); PCb: paclitaxel 80 + carbo AUC 2 D1,D8,D15 q28d ×6 | [PCDT-MAMA p.101] |
| Dose alternativa | Paclitaxel 80 mg/m² D1,D8,D15 + carboplatina AUC 5–6 D1 (dose máx. carbo = AUC × 150); CPNPC pacli pode ser 90 mg/m² | [EG-30] |
| Diluente/volume | Paclitaxel SF 0,9% 500 mL (livre de PVC); carboplatina G5% 500 mL | [EG-30] |
| Tempo | Paclitaxel 60 min; carboplatina 60 min | [EG-30] |
| Ordem | Paclitaxel → carboplatina (numeração) | [EG-30] |
| Estabilidade | nc | — |
| Ciclo | 21–28 dias (21 ovário/mama; 28 anal e CPNPC) | [EG-30] |

### 2.8 Cisplatina + gencitabina
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | CPNPC [EG-252]; trato urinário [EG-78]. MS: nc (nenhum DDT coletado traz dose) | — |
| Dose | Pulmão: gencitabina 1.000–1.250 mg/m² D1,D8 + cisplatina 75 mg/m² D1 [EG-252]; urotelial: gencitabina 1.000 mg/m² D1,D8,D15 + cisplatina 70 mg/m² D2 [EG-78] | [EG] |
| Diluente/volume | Gencitabina SF 0,9% 500 mL; cisplatina SF 0,9% 500 mL; hidratação SF 1.000 mL antes e depois + manitol 20% 250 mL | [EG-252] |
| Tempo | Gencitabina 60 min (fonte alerta: infusão >30 min associada a maior toxicidade); cisplatina 120 min | [EG-252] |
| Ordem | Hidratação → manitol → gencitabina → cisplatina → hidratação | [EG-252] |
| Estabilidade | nc | — |
| Ciclo | 21 dias ×4–6 [EG-252]; 21 ou 28 dias ×4–6 [EG-78] | [EG] |

### 2.9 Cisplatina + etoposídeo — [EG-44]
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | Pulmão pequenas células; bexiga/urotelial; neuroendócrino. MS cita "cisplatina/carboplatina + etoposídeo" sem dose [DDT-PULM p.11] | [EG-44] |
| Dose | Etoposídeo 100–120 mg/m² D1–D3; cisplatina 60–80 mg/m² D1 (pulmão s/ RT: 80+100; c/ RT: 60+120; urogenital: 75+120) | [EG-44] |
| Diluente/volume | Ambos SF 0,9% 500 mL (etoposídeo em bolsa livre de PVC); hidratação SF 1.000 mL pré/pós + manitol 20% 250 mL | [EG-44] |
| Tempo | Etoposídeo 60 min; cisplatina 120 min | [EG-44] |
| Ordem | Hidratação → manitol → etoposídeo → cisplatina → hidratação | [EG-44] |
| Estabilidade | nc | — |
| Ciclo | 21 dias, 4–6 ciclos | [EG-44] |

### 2.10 CHOP / R-CHOP
| Campo | Valor | Fonte |
|---|---|---|
| Indicação | LDGCB (CHOP; R-CHOP se CD20+) | [PCDT-LDGCB 6.1, p.8] |
| Dose | Ciclofosfamida 750 mg/m² EV D1; doxorrubicina 50 mg/m² EV D1; vincristina 1,4 mg/m² (máx. 2 mg) EV D1; prednisona 40 mg/m² VO D1–D5; rituximabe 375 mg/m² EV D1 | [PCDT-LDGCB] |
| Dose alternativa | Igual, exceto **prednisona 100 mg/dia VO D1–D5 (dose fixa)** | [EG-35] |
| Diluente/volume | Vincristina SF 0,9% 50 mL; doxorrubicina bolus; ciclofosfamida SF 0,9% 250 mL | [EG-35] |
| Tempo | Vincristina 10 min; doxorrubicina 5 min; ciclofosfamida 20 min | [EG-35] |
| Ordem | Rituximabe "antes dos demais quimioterápicos" [PCDT-LDGCB p.8]; vincristina → doxorrubicina → ciclofosfamida [EG-35] | ambos |
| Estabilidade | nc | — |
| Ciclo | 21 dias, 6 (até 8) ciclos [PCDT-LDGCB]; 21 dias [EG-35] | ambos |

### 2.11 Metotrexato
| Esquema | Valor | Fonte |
|---|---|---|
| CMF (mama) | Ciclofosfamida 100 mg/m² D1–D14 + metotrexato 40 mg/m² D1,D8 + 5-FU 600 mg/m² D1,D8; 28 dias ×6. Diluente/tempo/ordem/estabilidade: nc | [PCDT-MAMA p.100] |
| MTX semanal (cabeça e pescoço) | 40 mg/m² IM ou EVB 1×/sem, ou 20 mg/m² VO 2×/sem; pode subir a 50 / 25 mg/m² sem mucosite. Diluente: nc | [EG-90] |
| MTX alta dose (linfoma SNC) | 3.000 mg/m² EVI em SF 0,9% 500 mL, 3 h, D1; resgate folinato 30 mg EVB 6/6 h D2–D6, iniciando 24 h após início do MTX; hidratação 2,5–3,5 L/m²/dia; pH urinário ≥7; ciclo 21 dias | [EG-222] |

### 2.12 Demais esquemas com dose em fonte oficial (sem campos de preparo)
Transcritos de [PCDT-MAMA], [PCDT-LH], [DDT-SNC] — ver tabela completa em `REFERENCIA_BULAS_ANVISA_QUIMIOTERAPICOS.md` §2.2: T semanal, Tdd, CMF, FAC, FEC, EC, TAC, TCH, capecitabina monoterapia, docetaxel+pertuzumabe+trastuzumabe, ABVD, BEACOPP (padrão/escalonado), temozolomida+RT (Stupp), PCV. Para todos: diluente, volume, tempo de infusão, estabilidade e ordem = **não consta na fonte**.

### 2.13 Preparo por fármaco (fonte pública federal, sem esquema)
[HC-UFTM] tabela "Medicamento/Vias/Ação/Diluente/Tempo de infusão":

| Fármaco | Diluente | Tempo | Página |
|---|---|---|---|
| Carboplatina | SF 0,9% ou SG 5% (infusão prolongada: preferir SG 5%) | 15–120 min | p.13 |
| Cisplatina | nc na coluna | "não superior a 1 mg/min" | p.13 |
| Ciclofosfamida | SF 0,9% ou SG 5% | 20–120 min | p.14 |
| Oxaliplatina | SG 5% (não usar soluções com cloreto, nem em Y) | 120–360 min | p.17 |
| Fluoruracila | SF 0,9% ou SG 5% | 15 min a 24 h | p.19 |
| Gencitabina | SF 0,9% | 60 min | p.20 |
| Metotrexato | SF 0,9%, SG 5%, SRL | 30 min a 24 h | p.22 |
| Irinotecano | SG 5% ou SF 0,9% | 30–90 min ou 24 h | p.23 |
| Vincristina | SF 0,9% ou SG 5% | push / contínua 24 h | p.24 |
| Docetaxel | SF 0,9% ou SG 5% | 60 min | p.25 |
| Paclitaxel | SF 0,9% ou SG 5%; "administrar paclitaxel antes da cisplatina" | 60 min a 96 h | p.25 |
| Etoposídeo | SF 0,9% ou SG 5% | 30–60 min | p.26 |
| Doxorrubicina | SF 0,9% ou SG | periférico: até 30 min | p.27 |

## 3. Contagem de campos (esquemas 2.1–2.11; 7 campos: indicação, dose, diluente/volume, via, tempo, ordem, ciclo + estabilidade = 8)

| Esquema | Preenchidos | Não consta | Fonte da maioria |
|---|---|---|---|
| FOLFOX | 7/8 | estabilidade | alternativa |
| FOLFIRI | 7/8 | estabilidade | alternativa |
| CAPOX | 6/8 | ordem (n/a), estabilidade | alternativa |
| AC | 7/8 | estabilidade | oficial (dose) + alternativa |
| AC-T | 7/8 | estabilidade | oficial + alternativa |
| TC | 7/8 | estabilidade | oficial + alternativa |
| Carbo + pacli | 7/8 | estabilidade | oficial + alternativa |
| Cis + gencitabina | 7/8 | estabilidade (dose só alternativa) | alternativa |
| Cis + etoposídeo | 7/8 | estabilidade (dose só alternativa) | alternativa |
| CHOP/R-CHOP | 7/8 | estabilidade | oficial + alternativa |
| MTX (3 esquemas) | CMF 4/8; semanal 5/8; HD 7/8 | diluente/tempo/ordem (CMF); estabilidade em todos | misto |

Estabilidade de bolsa **nunca** consta em protocolo; só em bula (§4).

## 4. Cruzamento protocolo × bula (por fármaco)

✅ confere · ⚠️ diverge · ⛔ ausente (bula ou protocolo sem o dado / bula não disponível).

### 4.1 Oxaliplatina [B-OXA]
| Item | Protocolo | Bula | Resultado |
|---|---|---|---|
| Dose FOLFOX | 85 mg/m² D1/D15 [EG-72] | 85 mg/m² a cada 2 semanas c/ fluoropirimidinas [B-OXA p.7] | ✅ |
| Dose CAPOX | 130 mg/m² q21d [EG-116] | 130 mg/m² c/ capecitabina [B-OXA p.7] | ✅ |
| Diluente/volume | G5% 500 mL [EG-72/116]; SG 5% [HC-UFTM p.17] | G5% 250–500 mL, ≥0,2 mg/mL, nunca cloreto [B-OXA p.7–8] | ✅ |
| Tempo | 120 min [EG]; 120–360 min [HC-UFTM] | 2–6 h [B-OXA p.7] | ✅ |
| Co-infusão com folinato | "pode ser infundida em Y com folinato" [EG-72] | "não administre simultaneamente pela mesma linha"; não associar a ácido folínico com trometamol/soluções básicas [B-OXA p.6] | ⚠️ **diverge** — validar |
| Estabilidade bolsa | nc | G5%: 48 h 2–8 °C; 24 h 15–30 °C [B-OXA p.7] | ⛔ protocolo |

### 4.2 Fluoruracila [B-5FU]
| Item | Protocolo | Bula | Resultado |
|---|---|---|---|
| Dose FOLFOX/FOLFIRI | 400 mg/m² bolus + 2.400 mg/m² 46 h [EG-72/69] | Posologia em mg/kg (12 mg/kg/dia…) [B-5FU p.8]; estudos FOLFOX6/FOLFIRI 400 + 2,4–3,0 g/m² 46 h [B-5FU p.3] | ⚠️ posologia aprovada em mg/kg; confere só com estudos citados |
| Diluente/volume | 46 h em qsp 98 mL SF 0,9% [EG-69]; internado SF 1.000 mL [EG-72] | Infusão: 300–500 mL SG 5% ou SF 0,9% [B-5FU p.8] | ⚠️ volume diverge (infusor) |
| Estabilidade | 46 h em SF 0,9% [EG-69]; 23 h por bolsa SF [EG-72] | SF 0,9%: 8 h; SG 5%: 48 h [B-5FU p.8] | ⚠️ **diverge** — infusão 46 h em SF excede 8 h da bula |
| Tempo | 15 min a 24 h [HC-UFTM p.19] | nc em minutos | ⛔ bula |

### 4.3 Irinotecano [B-IRI]
| Item | Protocolo | Bula | Resultado |
|---|---|---|---|
| Dose FOLFIRI | 180 mg/m² q14d [EG-69] | Combinação recomendada: 125 mg/m² semanal ×4 a cada 6 sem. (c/ 5-FU 500, folinato 20 mg/m²) [B-IRI p.15]; 180 mg/m² aparece apenas como estudo na bula de 5-FU [B-5FU p.3] | ⚠️ diverge do esquema de bula |
| Diluente | G5% 500 mL [EG-69]; SG 5% ou SF [HC-UFTM p.23] | SG 5% ou SF 0,9%, 0,12–2,8 mg/mL [B-IRI p.14] | ✅ (concentração depende da SC) |
| Tempo | 90 min [EG-69]; 30–90 min ou 24 h [HC-UFTM] | 30–90 min [B-IRI p.14] | ✅ EG; ⚠️ HC-UFTM "24 h" fora da bula |
| Ordem | Irinotecano → folinato → 5-FU; Y com folinato [EG-69] | Folinato imediatamente após irinotecano, 5-FU após folinato; não adicionar fármacos à solução [B-IRI p.14–15] | ✅ sequência; ⚠️ Y-site não consta na bula |
| Estabilidade | nc | 24 h 15–30 °C (SF ou SG); 48 h 2–8 °C só SG 5%; SF não refrigerar; uso microbiológico 6 h TA / 24 h refrigerado [B-IRI p.13–14] | ⛔ protocolo |

### 4.4 Capecitabina [B-CAP]
| Item | Protocolo | Bula | Resultado |
|---|---|---|---|
| CAPOX | 2.000 mg/m²/dia (1.000 12/12 h) D1–D14 q21d [EG-116] | Combinação: 800–1.000 mg/m² 2×/dia ×2 sem. + 7 dias pausa [B-CAP p.16] | ✅ |
| Monoterapia mama | 1.000–1.250 mg/m² 2×/dia D1–D14 q21d [PCDT-MAMA] | 1.250 mg/m² 2×/dia ×14 dias + 7 pausa [B-CAP p.16] | ✅ (limite inferior 1.000 = faixa de combinação/redução) |
| Administração | 30 min após refeição; por sonda pode triturar [EG-116] | Até 30 min após refeições; "não deve ser partido, aberto ou mastigado" [B-CAP p.16] | ⚠️ trituração por sonda diverge |

### 4.5 Demais fármacos
Cisplatina, carboplatina, paclitaxel, docetaxel, doxorrubicina, ciclofosfamida, gencitabina, etoposídeo, vincristina, metotrexato, folinato: **⛔ ausente — bula não disponível em `bulas/` nesta coleta**; cruzamento pendente.

## 5. Não encontrado após busca alternativa

| Item | Onde se buscou | Situação |
|---|---|---|
| Doses de FOLFOX, FOLFIRI, CAPOX, IROX, FOLFIRINOX em fonte MS | PCDT-CCR 2025 | sem dose → usado [EG] (alternativa) |
| Doses cis/carbo+etoposídeo, carbo+pacli (pulmão), cis+gencitabina, BEP em fonte MS | DDT-PULM 2014, DDT Cabeça-Pescoço, Esôfago, Estômago | sem dose → [EG] |
| Estabilidade de bolsa em protocolo | MS, EG, HC-UFTM | não consta em nenhum; só bula |
| Lista de citotóxicos na RENAME | RENAME 2024 grupo L | não listados (financiamento APAC); lista de fármacos montada dos DDT/PCDT: bleomicina, carboplatina, carmustina, ciclofosfamida, cisplatina, citarabina, dacarbazina, docetaxel, doxorrubicina, epirrubicina, etoposídeo, fluoruracila, gencitabina, ifosfamida, irinotecano, lomustina, metotrexato, mitomicina, oxaliplatina, paclitaxel, pemetrexede, procarbazina, temozolomida, topotecano, vimblastina, vincristina, vinorelbina, capecitabina |
| INCA — publicações/rotinas | inca.gov.br (timeout); gov.br/inca/.../publicacoes e .../tratamento (HTTP 404) | não coletado |
| Conitec — página PCDT | gov.br/conitec (página responde 200, mas PDFs são os mesmos do gov.br/saude) | usados PDFs gov.br/saude |
| SBOC diretrizes | diretrizes.sboc.org.br (timeout) | não coletado |
| SBHH | sbhh.org.br (sem resposta) | não coletado |
| Bulas Anvisa de cisplatina, carboplatina, paclitaxel, docetaxel, doxorrubicina, ciclofosfamida, gencitabina, etoposídeo, vincristina, metotrexato | Bulário Anvisa API (HTTP 403); eurofarma.com.br (HTTP 403); pasta `bulas/` (ainda não chegaram) | pendente |
| Guia Einstein | medicalsuite.einstein.br (HTTP 403) | **consultar diretamente** |
| EBSERH POP UHHO.006 | intranet.ebserh.gov.br (intranet) | não acessado |

Nenhum login, captcha ou paywall foi contornado.
