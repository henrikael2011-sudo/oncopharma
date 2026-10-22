'use client';
// M24 — autocadastro pelo convite (link/QR da equipe). Sem login: o convite é de uso único e expira.
// O que for enviado chega à equipe como "pendente de conferência"; a equipe confere e entra em contato.
// Os campos de diagnóstico/tratamento só registram o que o paciente sabe — o app não avalia nem decide nada.
import { useEffect, useState } from 'react';
import { DEMO_TAG } from '../DemoLabels';

type Check = { valid: true; expiresAt: string; consentVersion: string };
type Form = { submittedBy: '' | 'patient' | 'caregiver'; fullName: string; birthDate: string; phone: string; email: string; cgName: string; cgRelationship: string; cgPhone: string; diagnosis: string; regimen: string; treatmentStart: string; hospitalName: string; consent: boolean };
const EMPTY: Form = { submittedBy: '', fullName: '', birthDate: '', phone: '', email: '', cgName: '', cgRelationship: '', cgPhone: '', diagnosis: '', regimen: '', treatmentStart: '', hospitalName: '', consent: false };
const when = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function SelfRegistration({ token, testEnv }: { token: string; testEnv: boolean }) {
  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'done'>('loading');
  const [check, setCheck] = useState<Check | null>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setErr(''); setF((x) => ({ ...x, [k]: v })); };
  useEffect(() => { (async () => {
    try { const r = await fetch(`/api/cadastro/${encodeURIComponent(token)}`, { cache: 'no-store' }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(typeof j.error === 'string' ? j.error : 'Convite indisponível.'); setState('invalid'); return; }
      setCheck(j as Check); setState('form');
    } catch { setMsg('Não foi possível abrir o convite agora. Tente de novo.'); setState('invalid'); }
  })(); }, [token]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const cg = f.cgName || f.cgRelationship || f.cgPhone ? { name: f.cgName, relationship: f.cgRelationship, phone: f.cgPhone } : null;
    try {
      const r = await fetch(`/api/cadastro/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ submittedBy: f.submittedBy, fullName: f.fullName, birthDate: f.birthDate, phone: f.phone, email: f.email || null, caregiver: cg, diagnosis: f.diagnosis, regimen: f.regimen || null, treatmentStart: f.treatmentStart || null, hospitalName: f.hospitalName || null, consent: f.consent }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(typeof j.error === 'string' ? j.error : 'Não foi possível enviar.'); return; }
      setMsg(j.message); setState('done'); setF(EMPTY);
    } catch { setErr('Sem conexão. Seus dados não foram enviados; tente de novo.'); } finally { setBusy(false); }
  }
  const caregiverFilling = f.submittedBy === 'caregiver';
  return <div className="care-page reg-page">
    <header className="care-header"><div className="cm-head-row"><span className="brand" aria-label="ONCOPHARMA Care"><img src="/brand/care-gold.svg" width={40} height={40} alt="" /><span><strong>ONCO<span>PHARMA</span></strong><small>CARE</small></span></span></div>{testEnv && <span className="cm-demo">{DEMO_TAG}</span>}</header>
    <main id="conteudo" className="reg-main">
      {state === 'loading' && <p role="status">Abrindo o convite…</p>}
      {state === 'invalid' && <section className="cm-card reg-card" role="alert"><h1>Convite indisponível</h1><p>{msg}</p><p className="cm-note">Em uma emergência, ligue 192 (SAMU).</p></section>}
      {state === 'done' && <section className="cm-card reg-card reg-done" role="status" aria-live="polite"><h1>Cadastro enviado</h1><p>{msg}</p>
        <p className="cm-note">Seu cadastro fica <b>pendente de conferência</b> até a equipe revisar. Este link não pode ser usado de novo.</p><p className="cm-note">Em uma emergência, ligue 192 (SAMU).</p></section>}
      {state === 'form' && check && <form className="cm-card reg-card reg-form" onSubmit={submit} noValidate={false}>
        <p className="reg-kicker">Cadastro por convite da equipe</p>
        <h1>Seus dados para o acompanhamento</h1>
        <p className="reg-lead">Preencha uma vez. A equipe confere tudo antes de usar — você não precisa repetir na consulta. Convite válido até {when(check.expiresAt)}, uso único.</p>
        <fieldset className="reg-who"><legend>Quem está preenchendo?</legend>
          <label className="reg-choice"><input type="radio" name="who" value="patient" required checked={f.submittedBy === 'patient'} onChange={() => set('submittedBy', 'patient')} /> Sou o paciente</label>
          <label className="reg-choice"><input type="radio" name="who" value="caregiver" checked={f.submittedBy === 'caregiver'} onChange={() => set('submittedBy', 'caregiver')} /> Sou cuidador(a) do paciente</label>
        </fieldset>
        <fieldset><legend>Paciente</legend>
          <label htmlFor="r-name">Nome completo</label><input id="r-name" autoComplete={caregiverFilling ? 'off' : 'name'} required minLength={3} maxLength={80} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <label htmlFor="r-birth">Data de nascimento</label><input id="r-birth" type="date" required autoComplete={caregiverFilling ? 'off' : 'bday'} value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          <label htmlFor="r-phone">Telefone (com DDD)</label><input id="r-phone" type="tel" inputMode="tel" required autoComplete={caregiverFilling ? 'off' : 'tel'} placeholder="(11) 91234-5678" maxLength={20} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <label htmlFor="r-email">E-mail <span className="reg-opt">(opcional)</span></label><input id="r-email" type="email" autoComplete={caregiverFilling ? 'off' : 'email'} maxLength={120} value={f.email} onChange={(e) => set('email', e.target.value)} />
        </fieldset>
        <fieldset><legend>Cuidador(a) {caregiverFilling ? '' : <span className="reg-opt">(opcional)</span>}</legend>
          <label htmlFor="r-cg-name">Nome do cuidador(a)</label><input id="r-cg-name" required={caregiverFilling} maxLength={80} value={f.cgName} onChange={(e) => set('cgName', e.target.value)} />
          <label htmlFor="r-cg-rel">Parentesco ou relação</label><input id="r-cg-rel" required={caregiverFilling} maxLength={40} placeholder="Filha, esposo, amiga…" value={f.cgRelationship} onChange={(e) => set('cgRelationship', e.target.value)} />
          <label htmlFor="r-cg-phone">Telefone do cuidador(a)</label><input id="r-cg-phone" type="tel" inputMode="tel" required={caregiverFilling} maxLength={20} value={f.cgPhone} onChange={(e) => set('cgPhone', e.target.value)} />
        </fieldset>
        <fieldset><legend>Tratamento (como a equipe médica informou)</legend>
          <label htmlFor="r-dx">Diagnóstico</label><input id="r-dx" required minLength={2} maxLength={120} placeholder="Ex.: câncer de mama" value={f.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />
          <label htmlFor="r-reg">Tratamento ou protocolo <span className="reg-opt">(se souber)</span></label><input id="r-reg" maxLength={120} placeholder="Ex.: quimioterapia a cada 21 dias" value={f.regimen} onChange={(e) => set('regimen', e.target.value)} />
          <label htmlFor="r-start">Início do tratamento <span className="reg-opt">(se souber)</span></label><input id="r-start" type="date" value={f.treatmentStart} onChange={(e) => set('treatmentStart', e.target.value)} />
          <label htmlFor="r-hosp">Hospital ou clínica <span className="reg-opt">(opcional)</span></label><input id="r-hosp" maxLength={80} value={f.hospitalName} onChange={(e) => set('hospitalName', e.target.value)} />
          <p className="cm-note">Estes campos só ajudam a equipe a localizar seu cadastro. O aplicativo não avalia diagnóstico nem tratamento.</p>
        </fieldset>
        <label className="reg-consent"><input type="checkbox" required checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /> <span>Autorizo o envio destes dados à equipe de cuidado para conferência e acompanhamento. Sei que o aplicativo não substitui consulta nem atendimento de urgência.</span></label>
        {err && <p className="reg-error" role="alert">{err}</p>}
        <button type="submit" className="btn-primary btn-large reg-submit" disabled={busy || !f.consent || !f.submittedBy}>{busy ? 'Enviando…' : 'Enviar cadastro'}</button>
        <p className="cm-note">Em uma emergência, ligue 192 (SAMU).</p>
      </form>}
    </main>
  </div>;
}
