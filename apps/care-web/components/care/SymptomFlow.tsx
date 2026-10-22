'use client';
// M15.2 — registro estruturado de sintoma: uma pergunta por tela, revisão e confirmação.
// Perguntas demonstrativas (care-demo-v1), pendentes de validação clínica institucional.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { care } from '../../lib/care-client';
import { useMe } from './CareShell';
import { TemperatureSection } from './TempChart';
import { Tile } from './Icons';
import { isUrgentLocal, LOCAL_URGENT_TEXT, LOCAL_URGENT_TITLE, SEND_FAILED_TEXT } from '../../lib/care-urgency';
const SYMPTOMS: [string, string][] = [['nausea', 'Enjoo ou vômito'], ['neuropathy', 'Formigamento'], ['fever', 'Febre'], ['diarrhea', 'Diarreia'], ['fatigue', 'Cansaço'], ['pain', 'Dor'], ['mouth', 'Feridas na boca'], ['other', 'Outro']];
const INTENSITY: [string, string][] = [['leve', 'Leve — consigo fazer minhas atividades'], ['moderada', 'Moderada — atrapalha um pouco'], ['forte', 'Forte — não consigo fazer minhas atividades']];
const ONSET: [string, string][] = [['hoje', 'Hoje'], ['1-3-dias', 'De 1 a 3 dias'], ['mais-3-dias', 'Há mais de 3 dias']];
const FLAGS: [string, string][] = [['febre', 'Febre (37,8 °C ou mais)'], ['falta_ar', 'Falta de ar'], ['sangramento', 'Sangramento'], ['nao_bebe', 'Não consigo beber líquidos'], ['confusao', 'Confusão ou muita sonolência']];
const label = (list: [string, string][], v: string) => list.find(([k]) => k === v)?.[1] ?? '';
type Result = { reportId: string; urgent: boolean; message: string };

function Radio({ name, legend, options, value, onChange }: { name: string; legend: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <fieldset className="choices"><legend>{legend}</legend>{options.map(([k, l]) => <label key={k} className="choice"><input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(k)} /> {l}</label>)}</fieldset>;
}
export function SymptomFlow() {
  const { me } = useMe(); const who = me.actor === 'caregiver' ? (me.patientName ?? 'a pessoa que você acompanha') : null;
  const [step, setStep] = useState(0), [symptomCode, setSymptom] = useState(''), [intensity, setIntensity] = useState(''), [onset, setOnset] = useState('');
  const [flags, setFlags] = useState<string[]>([]), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [result, setResult] = useState<Result | null>(null);
  const requestId = useMemo(() => crypto.randomUUID(), []); // idempotência: repetir o envio não duplica
  const urgentNow = isUrgentLocal({ symptomCode, intensity, redFlags: flags }); // M16: sem depender da API
  const steps = 5; const canNext = [symptomCode, intensity, onset, 'ok', 'ok'][step];
  async function send() { setBusy(true); setErr(''); try { setResult(await care<Result>('me/symptoms', { method: 'POST', body: { symptomCode, intensity, onset, redFlags: flags, description, requestId } })); } catch (e) { setErr(`${SEND_FAILED_TEXT}${e instanceof Error && e.message ? ` (${e.message})` : ''}`); } finally { setBusy(false); } }
  if (result) { const urgent = result.urgent || urgentNow; return <section className={urgent ? 'care-panel care-urgent' : 'care-panel'} role={urgent ? 'alert' : 'status'} aria-labelledby="sym-done">
    <h1 id="sym-done">{urgent ? LOCAL_URGENT_TITLE : 'Relato registrado'}</h1>
    <p className="care-lead">{result.message}</p>
    <p className="care-note">Número do registro: <span data-report-id={result.reportId}>{result.reportId.slice(0, 8)}</span></p>
    {urgent && <p><a className="btn-primary" href="tel:192">Ligar 192</a></p>}
    <Link className="btn-primary" href="/care">Voltar ao início</Link>
  </section>; }
  return <section aria-labelledby="sym-title">
    <div><h1 id="sym-title">{who ? `Como ${who} se sente agora?` : 'Como você se sente agora?'}</h1><p className="care-lead">Registre como você está. A equipe acompanha.</p></div>
    <TemperatureSection />
    {urgentNow && <div className="care-panel care-urgent" role="alert" data-local-urgent><h2>{LOCAL_URGENT_TITLE}</h2><p className="care-lead">{LOCAL_URGENT_TEXT}</p><p><a className="btn-primary" href="tel:192">Ligar 192</a></p></div>}
    <section className="care-card cm-sym-card" aria-labelledby="sym-today"><h2 id="sym-today"><Tile name="notebook" />Sintomas de hoje</h2>
    <p className="care-note" aria-live="polite">Passo {step + 1} de {steps}</p>
    <form className="workflow-form" onSubmit={(e) => { e.preventDefault(); if (step < steps - 1) { if (canNext) setStep(step + 1); } else void send(); }}>
      {step === 0 && <Radio name="symptom" legend="O que você está sentindo?" options={SYMPTOMS} value={symptomCode} onChange={setSymptom} />}
      {step === 1 && <Radio name="intensity" legend="Quanto isso atrapalha você?" options={INTENSITY} value={intensity} onChange={setIntensity} />}
      {step === 2 && <Radio name="onset" legend="Quando começou?" options={ONSET} value={onset} onChange={setOnset} />}
      {step === 3 && <fieldset className="choices"><legend>Você tem algum destes sinais agora?</legend>{FLAGS.map(([k, l]) => <label key={k} className="choice"><input type="checkbox" checked={flags.includes(k)} onChange={(e) => setFlags(e.target.checked ? [...flags, k] : flags.filter((f) => f !== k))} /> {l}</label>)}<p className="care-note">Se nenhum, apenas continue.</p></fieldset>}
      {step === 4 && <><label htmlFor="care-description">Quer contar mais alguma coisa? (opcional)</label><textarea id="care-description" maxLength={1000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="care-review" aria-label="Resumo do relato"><h2>Confira antes de enviar</h2><ul className="care-list"><li>Sintoma: {label(SYMPTOMS, symptomCode)}</li><li>Intensidade: {label(INTENSITY, intensity)}</li><li>Início: {label(ONSET, onset)}</li><li>Sinais de alerta: {flags.length ? flags.map((f) => label(FLAGS, f)).join(', ') : 'nenhum'}</li></ul></div></>}
      <div className="care-actions">
        {step > 0 && <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>Voltar</button>}
        <button type="submit" className="btn-primary" disabled={!canNext || busy}>{step < steps - 1 ? 'Continuar' : 'Enviar para a equipe'}</button>
      </div>
    </form>
    </section>
    {err && <p role="alert">{err}</p>}
    <p className="care-note">Em uma emergência, ligue 192 (SAMU).</p>
    <p className="cm-note">O app só organiza e registra. Sua equipe de saúde avalia e decide.</p>
  </section>;
}
