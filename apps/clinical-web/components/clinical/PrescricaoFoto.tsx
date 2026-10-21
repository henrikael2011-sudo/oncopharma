'use client';
// M18 — Prescrição por foto / prescrição virtual (FASE A, dados fictícios). O sistema não aprova nada:
// o farmacêutico valida ou desvalida cada item. Sugestões no estilo "Resumo com IA · rascunho".
// PROVISÓRIO (Q4 — uso de iPad/Safari): layout responsivo genérico (lado a lado ≥ 900px, empilhado abaixo),
// alvos de toque ≥ 44px, sem APIs específicas de dispositivo (câmera/arquivos). Ver docs/decisoes-provisorias-prescricao-foto.md.
import { useState } from 'react';
import { PRESCRICAO_FICTICIA as P, type ItemStatus } from '../../lib/prescricao-ficticia';
const ROTULO: Record<ItemStatus, string> = { pendente: 'Pendente', conferido: 'Conferido', desvalidado: 'Desvalidado' };
export function PrescricaoFoto() {
  const [st, setSt] = useState<Record<string, ItemStatus>>(() => Object.fromEntries(P.itens.map((i) => [i.id, 'pendente'])));
  const n = (s: ItemStatus) => P.itens.filter((i) => st[i.id] === s).length;
  return <section className="rx-page" aria-labelledby="rx-title">
    <p className="kicker">Fase A · dados fictícios</p>
    <h1 id="rx-title">Validação de prescrição por foto</h1>
    <p className="clinical-notice"><strong>Não liberado para uso clínico.</strong> Protótipo com prescrição inventada. O sistema não aprova nem decide: cada item é validado pelo farmacêutico. Software como dispositivo médico sujeito à RDC Anvisa 657/2022.</p>
    <div className="rx-split">
      <figure className="rx-photo" aria-label="Foto fictícia da prescrição">
        <div className="rx-photo-sheet">{P.linhasFoto.map((l) => <p key={l}>{l}</p>)}</div>
        <figcaption>Imagem ilustrativa fictícia — nenhuma foto real é carregada nesta fase.</figcaption>
      </figure>
      <div className="rx-items">
        <p className="rx-meta">{P.paciente} · {P.esquema}</p>
        <ul>{P.itens.map((i) => <li key={i.id} className={`rx-item rx-${st[i.id]}`}>
          <div className="rx-item-head"><strong className="rx-field">{i.campo}</strong><span className="rx-badge">{ROTULO[st[i.id]]}</span></div>
          <p className="rx-read">Transcrito: {i.lido}</p>
          <div className="rx-ai"><span className="rx-draft">Resumo com IA · rascunho</span><p>{i.sugestao}</p><small>A IA não decide. Apenas apoia a revisão do farmacêutico.</small></div>
          <div className="rx-actions">
            <button type="button" className="btn-primary" aria-pressed={st[i.id] === 'conferido'} onClick={() => setSt({ ...st, [i.id]: 'conferido' })}>Validar</button>
            <button type="button" className="btn-secondary" aria-pressed={st[i.id] === 'desvalidado'} onClick={() => setSt({ ...st, [i.id]: 'desvalidado' })}>Desvalidar</button>
            {st[i.id] !== 'pendente' && <button type="button" className="btn-secondary" onClick={() => setSt({ ...st, [i.id]: 'pendente' })}>Voltar a pendente</button>}
          </div>
        </li>)}</ul>
      </div>
    </div>
    <footer className="rx-footer" role="status" aria-live="polite">
      <span className="rx-conferido">{n('conferido')} conferido(s)</span> · <span className="rx-pendente">{n('pendente')} pendente(s)</span> · <span className="rx-desvalidado">{n('desvalidado')} desvalidado(s)</span>
      <span> — {n('pendente') > 0 ? `Faltam ${n('pendente')} item(ns) para revisar.` : 'Todos os itens revisados pelo farmacêutico. Nada é aprovado automaticamente.'}</span>
    </footer>
  </section>;
}
