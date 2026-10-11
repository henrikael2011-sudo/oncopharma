import Link from 'next/link';
// M15.1: o logotipo leva ao início do próprio app (evita link para "/" que apenas redireciona).
export function Brand({ variant = 'main', href }: { variant?: 'main'|'care'|'clinical'; href?: string }) {
  const home = href ?? (variant === 'care' ? '/care' : variant === 'clinical' ? '/clinical' : '/');
  const icon = variant === 'care' ? '/brand/care.svg' : variant === 'clinical' ? '/brand/clinical.svg' : '/brand/mark.svg';
  return <Link href={home} className="brand" aria-label={`${variant === 'care' ? 'ONCOPHARMA Care' : variant === 'clinical' ? 'ONCOPHARMA Clinical' : 'ONCOPHARMA'} — página inicial`}>
    <img src={icon} width={52} height={52} alt="" />
    <span><strong>ONCO<span>PHARMA</span></strong><small>{variant === 'main' ? 'Inteligência para um cuidado mais seguro' : variant === 'care' ? 'Care · Paciente e cuidador' : 'Clinical · Equipe multiprofissional'}</small></span>
  </Link>;
}
