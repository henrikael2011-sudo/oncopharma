// M23 — mostra a orientação de cada alerta (texto do paciente ou do cuidador). Textos em lib/care-guidance.ts.
import { ALERT_GUIDANCE, type AlertKey } from '../../lib/care-guidance';
export function AlertGuidanceList({ keys, caregiver }: { keys: AlertKey[]; caregiver: boolean }) {
  if (!keys.length) return null;
  return <ul className="care-list" data-alert-guidance>{keys.map((k) => <li key={k} data-alert-key={k}><strong>{ALERT_GUIDANCE[k].title}</strong><br />{caregiver ? ALERT_GUIDANCE[k].caregiver : ALERT_GUIDANCE[k].patient}</li>)}</ul>;
}
