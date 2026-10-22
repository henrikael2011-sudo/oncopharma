// M21.2 — geometria do gráfico de temperatura (7 dias). Sem JSX/dependências: testável em node (tests/m212-*).
export const W = 340, H = 170, L = 34, R = 18, T = 12, B = 26;
export const CHART_FEVER_C = 37.8; // = FEVER_THRESHOLD_C (care-guidance.ts / care-rules.ts); verificado em teste
export type ChartReading = { celsius: number; measuredAt: string };
/** Escala fixa 35–40 °C (alargada se houver leitura fora dela); eixo x = últimos 7 dias até "agora". */
export function chartGeometry<T extends ChartReading>(readings: T[], now = Date.now()) {
  const min = Math.min(35, ...readings.map((r) => Math.floor(r.celsius))), max = Math.max(40, ...readings.map((r) => Math.ceil(r.celsius)));
  const t0 = now - 7 * 86_400_000;
  const x = (iso: string) => L + Math.max(0, Math.min(1, (new Date(iso).getTime() - t0) / (now - t0))) * (W - L - R);
  const y = (v: number) => T + ((max - v) * (H - T - B)) / (max - min);
  const pts = readings.map((r) => ({ x: x(r.measuredAt), y: y(r.celsius), r }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - B} L${pts[0].x.toFixed(1)},${H - B} Z` : '';
  const grid = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const days = Array.from({ length: 4 }, (_, i) => new Date(t0 + (i * (now - t0)) / 3).toISOString());
  return { pts, line, area, grid, days, x, y, min, max, thresholdY: y(CHART_FEVER_C) };
}
