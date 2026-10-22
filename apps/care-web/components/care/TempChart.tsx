'use client';
// M21.2 — temperatura: entrada grande e simples + gráfico dos últimos 7 dias com as leituras REAIS (GET me/temperatures).
// Leitura >= 37,8 °C (regra aprovada) mostra a orientação urgente existente e o 192. Cores via CSS (sem hex no TSX).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { care } from '../../lib/care-client';
import { isFeverLocal, LOCAL_URGENT_TEXT, LOCAL_URGENT_TITLE, SEND_FAILED_TEXT } from '../../lib/care-urgency';
import { FEVER_THRESHOLD_C, FEVER_THRESHOLD_LABEL } from '../../lib/care-guidance';
import { Skeleton } from './CareShell';
import { chartGeometry, H, L, R, W } from '../../lib/temp-chart';
import { Icon, Tile } from './Icons';
export type Reading = { id: string; celsius: number; measuredAt: string; recordedBy: 'patient' | 'caregiver'; fever: boolean };
type Saved = { readingId: string; urgent: boolean; message: string };
const br = (v: number) => v.toFixed(1).replace('.', ',');
const day = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
export function TemperatureSection() {
  const [list, setList] = useState<Reading[] | null>(null), [err, setErr] = useState('');
  const [value, setValue] = useState(36.5), [busy, setBusy] = useState(false), [saved, setSaved] = useState<Saved | null>(null), [sendErr, setSendErr] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const load = useCallback(() => care<{ readings: Reading[] }>('me/temperatures').then((r) => setList(r.readings)).catch((e) => setErr(e instanceof Error ? e.message : 'Erro')), []);
  useEffect(() => { void load(); }, [load]);
  const step = (d: number) => { setSaved(null); setValue((v) => Math.min(43, Math.max(34, Math.round((v + d) * 10) / 10))); };
  async function save() { setBusy(true); setSendErr(''); try { const r = await care<Saved>('me/temperatures', { method: 'POST', body: { celsius: value, requestId } }); setSaved(r); setRequestId(crypto.randomUUID()); await load(); } catch (e) { setSendErr(`${SEND_FAILED_TEXT}${e instanceof Error && e.message ? ` (${e.message})` : ''}`); } finally { setBusy(false); } }
  const urgentNow = isFeverLocal(value);
  return <div id="temperatura" className="cm-temp-grid">
    {err ? <p role="alert">{err}</p> : !list ? <Skeleton label="Carregando temperaturas…" /> : <TempChart readings={list} />}
    <div className="cm-side-col">
    <section className="care-card" aria-labelledby="temp-in"><h2 id="temp-in"><Tile name="thermo" />Registrar temperatura</h2>
      <div className="cm-temp" role="group" aria-label="Temperatura em graus Celsius">
        <button type="button" className="cm-temp-btn" aria-label="Diminuir 0,1 grau" onClick={() => step(-0.1)}>− 0,1</button>
        <label className="cm-temp-val"><span className="cm-visually-hidden">Temperatura (°C)</span><input id="temp-value" inputMode="decimal" value={br(value)} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n) && n >= 34 && n <= 43) { setSaved(null); setValue(Math.round(n * 10) / 10); } }} /><span aria-hidden="true">°C</span></label>
        <button type="button" className="cm-temp-btn" aria-label="Aumentar 0,1 grau" onClick={() => step(0.1)}>+ 0,1</button>
      </div>
      <p className="cm-sub">Febre ({FEVER_THRESHOLD_LABEL} ou mais) é sinal de alerta.</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}><Icon name="circleCheck" />Salvar temperatura</button>
      {sendErr && <p role="alert">{sendErr}</p>}
    </section>
    {(saved?.urgent || (urgentNow && !saved)) && <div className="care-panel care-urgent" role="alert" data-temp-urgent><h2>{LOCAL_URGENT_TITLE}</h2><p className="care-lead">{saved?.urgent ? saved.message : LOCAL_URGENT_TEXT}</p><p><a className="btn-primary" href="tel:192">Ligar 192</a></p></div>}
    {saved && !saved.urgent && <p role="status" className="care-note">{saved.message}</p>}
    </div>
  </div>;
}
export function TempChart({ readings }: { readings: Reading[] }) {
  const g = useMemo(() => chartGeometry(readings), [readings]);
  return <section className="care-card" aria-labelledby="temp-title" data-temp-chart data-count={readings.length}>
    <h2 id="temp-title"><Tile name="thermo" />Temperatura · 7 dias</h2>
    {readings.length === 0 ? <p className="cm-sub" data-temp-empty>Nenhuma temperatura registrada nos últimos 7 dias.</p> : <>
      <svg className="cm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperaturas dos últimos 7 dias: ${readings.map((r) => `${br(r.celsius)} °C em ${day(r.measuredAt)}`).join('; ')}. Linha de febre em ${FEVER_THRESHOLD_LABEL}.`}>
        {g.grid.map((v) => <g key={v}><line className="cm-chart-grid" x1={L} x2={W - R} y1={g.y(v)} y2={g.y(v)} /><text className="cm-chart-axis" x={L - 6} y={g.y(v) + 4} textAnchor="end">{v}</text></g>)}
        {g.area && <path className="cm-chart-fill" d={g.area} />}
        <line className="cm-chart-fever" x1={L} x2={W - R} y1={g.thresholdY} y2={g.thresholdY} data-threshold={FEVER_THRESHOLD_C} />
        <text className="cm-chart-fever-label" x={L + 4} y={g.thresholdY - 5} textAnchor="start">Febre: {FEVER_THRESHOLD_LABEL} ou mais</text>
        <path className="cm-chart-line" d={g.line} />
        {g.pts.map((p) => <circle key={p.r.id} className={p.r.fever ? 'cm-chart-dot cm-chart-dot-fever' : 'cm-chart-dot'} cx={p.x} cy={p.y} r={4} />)}
        {g.days.map((d, i) => <text key={d} className="cm-chart-axis" x={g.x(d)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}>{day(d)}</text>)}
      </svg>
      <ul className="care-list cm-temp-list">{[...readings].reverse().slice(0, 5).map((r) => <li key={r.id}><b>{br(r.celsius)} °C</b> — {new Date(r.measuredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}{r.recordedBy === 'caregiver' ? ' · cuidador' : ''}{r.fever && <> · <span className="cm-fever">febre</span></>}</li>)}</ul></>}
  </section>;
}
