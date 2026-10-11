import Link from 'next/link';
import { Brand } from '../components/Brand';
export default function Home() {return <div className="site-shell home">
  <header className="topbar"><Brand/><span className="eyebrow">M10.2 · ambiente de desenvolvimento e homologação</span></header>
  <main id="conteudo" className="hero">
    <div className="hero-copy"><p className="kicker">TECNOLOGIA A SERVIÇO DA ONCOLOGIA</p><h1>O cuidado continua.<br/><em>A informação conecta.</em></h1>
      <p className="lead">Uma plataforma, duas experiências: acolhimento e simplicidade para pacientes; informação clínica organizada para profissionais.</p>
      <div className="notice" role="status"><strong>Ambiente de construção</strong><span>Há fluxos experimentais de Care e Clinical ligados a rotas de API no código. Para funcionar, dependem de banco PostgreSQL, identidade institucional e permissões configurados e testados. Não há operação assistencial.</span></div>
    </div>
    <div className="experience-grid">
      <Link className="experience care" href="/care"><span className="experience-icon"><img src="/brand/care.svg" alt="" /></span><span className="overline">PARA PACIENTES E CUIDADORES</span><strong>ONCOPHARMA <i>Care</i></strong><span>Simples para usar. Acolhedor em cada etapa.</span><span className="enter">Acessar ambiente de testes <span aria-hidden>→</span></span></Link>
      <Link className="experience clinical" href="/clinical"><span className="experience-icon"><img src="/brand/clinical.svg" alt="" /></span><span className="overline">PARA EQUIPES DE SAÚDE</span><strong>ONCOPHARMA <i>Clinical</i></strong><span>Informação, segurança e apoio à decisão.</span><span className="enter">Acessar ambiente de testes <span aria-hidden>→</span></span></Link>
    </div>
  </main><footer className="footer">ONCOPHARMA · Care + Clinical · Uso exclusivo com dados sintéticos · Sem uso assistencial</footer>
</div>}
