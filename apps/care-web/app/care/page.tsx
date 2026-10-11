import { CareSymptomReport } from '../../components/CareSymptomReport';
import Link from 'next/link';
import { Brand } from '../../components/Brand';
export default function Care(){return <div className="care-page"><header className="care-header"><Brand variant="care"/><Link href="/" className="back">← Voltar</Link></header>
<main id="conteudo" className="care-main"><p className="kicker">ONCOPHARMA CARE</p><h1>Seu cuidado, no seu ritmo.</h1><p className="care-lead">Um espaço pensado para ser fácil de entender e de usar, inclusive por quem tem pouca familiaridade com tecnologia.</p>
<section className="care-cards" aria-label="Funcionalidades e situação de desenvolvimento"><div className="care-card"><span className="care-symbol" aria-hidden>♡</span><h2>Como estou hoje?</h2><p>Registro guiado de sintomas, com perguntas curtas.</p><span className="planned">Em desenvolvimento</span></div>
<div className="care-card"><span className="care-symbol" aria-hidden>◷</span><h2>Minha jornada</h2><p>Consultas, medicamentos e orientações aprovadas.</p><span className="planned">Em desenvolvimento</span></div>
<div className="care-card help"><span className="care-symbol" aria-hidden>＋</span><h2>Preciso de ajuda</h2><p>Informações de segurança e contatos institucionais, quando configurados.</p><span className="planned">Em desenvolvimento</span></div></section>
<div className="notice light"><strong>Importante</strong><span>O formulário abaixo envia relatos exclusivamente para a API de testes quando o ambiente está configurado. Não há equipe monitorando estes relatos. Em uma emergência real no Brasil, ligue 192.</span></div>
<CareSymptomReport/></main></div>}
