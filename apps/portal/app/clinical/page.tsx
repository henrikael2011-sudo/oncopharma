import { ClinicalAccess } from '../../components/ClinicalAccess';
import Link from 'next/link';
import { Brand } from '../../components/Brand';
const modules = [
['01','Painel clínico','Fila de acompanhamento, prioridades e pendências.'],
['02','Pacientes','Histórico longitudinal e fontes dos registros.'],
['03','Avaliação pré-ciclo','Exames, protocolo, toxicidades e checklist.'],
['04','Inteligência clínica','Correlação fundamentada e validação profissional.'],
['05','Intervenções','Pareceres, encaminhamentos e desfechos.'],
['06','Protocolos','Conteúdo institucional versionado e aprovado.']];
export default function Clinical(){return <div className="clinical-page"><header className="clinical-header"><Brand variant="clinical"/><Link href="/" className="back">← Voltar</Link></header>
<main id="conteudo" className="clinical-main"><div className="clinical-heading"><div><p className="kicker">AMBIENTE PROFISSIONAL</p><h1>ONCOPHARMA Clinical</h1><p>Arquitetura da central de acompanhamento multiprofissional.</p></div><span className="environment">M10.2 · TESTES</span></div>
<div className="clinical-notice" role="status">O código possui consultas e revisões experimentais de alertas sintéticos. A operação depende de autenticação institucional, banco PostgreSQL e vínculo assistencial configurados. Sem validação integrada ou uso clínico real.</div>
<div className="clinical-grid">{modules.map(([n,title,desc])=><article className="module" key={n}><span className="module-index">{n}</span><h2>{title}</h2><p>{desc}</p><span className="planned">Protótipo técnico · validar integração</span></article>)}</div>
<ClinicalAccess/>
</main></div>}
