import Link from 'next/link';
export function Brand({ variant = 'main' }: { variant?: 'main'|'care'|'clinical' }) {
  const icon = variant === 'care' ? '/brand/care.svg' : variant === 'clinical' ? '/brand/clinical.svg' : '/brand/mark.svg';
  return <Link href="/" className="brand" aria-label={`${variant === 'care' ? 'ONCOPHARMA Care' : variant === 'clinical' ? 'ONCOPHARMA Clinical' : 'ONCOPHARMA'} — página inicial`}>
    <img src={icon} width={52} height={52} alt="" />
    <span><strong>ONCO<span>PHARMA</span></strong><small>{variant === 'main' ? 'Inteligência para um cuidado mais seguro' : variant === 'care' ? 'Care · Paciente e cuidador' : 'Clinical · Equipe multiprofissional'}</small></span>
  </Link>;
}
