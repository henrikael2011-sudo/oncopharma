'use client';
// M21 — gráfico de temperatura (7 dias). A API do Care ainda NÃO expõe temperaturas registradas
// (me/symptoms guarda só sintoma/intensidade/início/sinais), então os pontos são EXEMPLO ESTÁTICO fictício, rotulado.
// Linha tracejada dourada = limiar aprovado de febre (37,8 °C, care-rules.ts). Cores via CSS (sem hex no TSX).
import { useEffect, useState } from 'react';
import { Skeleton } from './CareShell';
import { Tile } from './Icons';
import { FEVER_THRESHOLD_C, FEVER_THRESHOLD_LABEL } from '../../lib/care-guidance';
export const DEMO_TEMPS: [string, number][] = [['15/10', 36.6], ['16/10', 36.8], ['17/10', 36.7], ['18/10', 37.0], ['19/10', 36.9], ['20/10', 37.2], ['21/10', 37.4]];
const W = 340, H = 170, L = 34, R = 18, T = 12, B = 26, MIN = 36, MAX = 38.4;
const x = (i: number) => L + (i * (W - L - R)) / (DEMO_TEMPS.length - 1);
const y = (v: number) => T + ((MAX - v) * (H - T - B)) / (MAX - MIN);
const br = (v: number) => v.toFixed(1).replace('.', ',');
export function TempChart() {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 300); return () => clearTimeout(t); }, []);
  if (!ready) return <Skeleton label="Carregando temperaturas…" />;
  const line = DEMO_TEMPS.map(([, v], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(DEMO_TEMPS.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  return <section className="care-card" aria-labelledby="temp-title" data-static-demo data-temp-chart><span className="cm-static">Exemplo estático · fictício</span>
    <h2 id="temp-title"><Tile name="thermo" />Temperatura · 7 dias</h2>
    <svg className="cm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Exemplo fictício de temperaturas dos últimos 7 dias; linha de febre em ${FEVER_THRESHOLD_LABEL}`}>
      {[36, 36.5, 37, 37.5, 38].map((g) => <g key={g}><line className="cm-chart-grid" x1={L} x2={W - R} y1={y(g)} y2={y(g)} /><text className="cm-chart-axis" x={L - 6} y={y(g) + 4} textAnchor="end">{br(g)}</text></g>)}
      <path className="cm-chart-fill" d={area} />
      <line className="cm-chart-fever" x1={L} x2={W - R} y1={y(FEVER_THRESHOLD_C)} y2={y(FEVER_THRESHOLD_C)} data-threshold={FEVER_THRESHOLD_C} />
      <text className="cm-chart-fever-label" x={W - R} y={y(FEVER_THRESHOLD_C) - 5} textAnchor="end">Febre: {FEVER_THRESHOLD_LABEL} ou mais</text>
      <path className="cm-chart-line" d={line} />
      {DEMO_TEMPS.map(([d, v], i) => <g key={d}><circle className="cm-chart-dot" cx={x(i)} cy={y(v)} r={3.5} /><text className="cm-chart-axis" x={x(i)} y={H - 8} textAnchor="middle">{d}</text></g>)}
    </svg>
    <p className="cm-sub">O app ainda não registra temperatura; os pontos acima são fictícios. Febre ({FEVER_THRESHOLD_LABEL} ou mais) é sinal de alerta.</p>
  </section>;
}
