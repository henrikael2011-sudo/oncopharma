import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { IncomingMessage } from 'http';

export interface Principal { sub: string; issuer: string; mfa: boolean; claims: JWTPayload; }
export type AuthenticatedRequest = IncomingMessage & { principal: Principal; headers: IncomingMessage['headers'] };

const list = (v: string | undefined, fallback: string[]) => (v === undefined || v.trim() === '') ? fallback : v.split(',').map(x => x.trim()).filter(x => x && x !== 'none');
/**
 * MFA por provedor (D-009), sempre a partir de claims assinados — nunca por e-mail, domínio ou cabeçalho.
 * - OIDC_MFA_AMR: valores de `amr` aceitos (padrão mfa,otp,webauthn,hwk). Entra ID: "mfa" (no Entra, "otp" = SMS/e-mail, não usar).
 *   "none" desabilita o critério amr.
 * - OIDC_MFA_ACR: valores de `acr` aceitos (alternativa ao amr).
 * - OIDC_MFA_ACRS: se definido, EXIGE adicionalmente um Authentication Context do Entra no claim `acrs`
 *   (ex.: c1 = Acesso Condicional com força de autenticação "app autenticador, sem SMS").
 */
export function mfaSatisfied(payload: JWTPayload): boolean {
  const amr = Array.isArray(payload.amr) ? payload.amr.map(String) : [];
  const acr = typeof payload.acr === 'string' ? payload.acr : '';
  const acrs = Array.isArray((payload as Record<string, unknown>).acrs) ? ((payload as Record<string, unknown>).acrs as unknown[]).map(String) : [];
  const amrOk = list(process.env.OIDC_MFA_AMR, ['mfa', 'otp', 'webauthn', 'hwk']).some(v => amr.includes(v));
  const acrOk = list(process.env.OIDC_MFA_ACR, []).includes(acr);
  const requiredAcrs = list(process.env.OIDC_MFA_ACRS, []);
  const acrsOk = requiredAcrs.length === 0 || requiredAcrs.some(v => acrs.includes(v));
  return (amrOk || acrOk) && acrsOk;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const issuer = process.env.OIDC_ISSUER, audience = process.env.OIDC_AUDIENCE, jwksUri = process.env.OIDC_JWKS_URI;
    if (!issuer || !audience || !jwksUri) throw new ServiceUnavailableException('Identidade OIDC não configurada');
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ') || header.length > 8192) throw new UnauthorizedException('Token Bearer necessário');
    try {
      if (!this.jwks) this.jwks = createRemoteJWKSet(new URL(jwksUri));
      const { payload } = await jwtVerify(header.slice(7), this.jwks, { issuer, audience, algorithms: ['RS256','ES256'], clockTolerance: 5 });
      // M15 (D-009): identificador estável configurável. Entra ID: 'oid' (o 'sub' do Entra é pareado por aplicação).
      const subjectClaim = process.env.OIDC_SUBJECT_CLAIM || 'sub';
      const subject = payload[subjectClaim];
      if (!subject || typeof subject !== 'string') throw new UnauthorizedException('Sujeito ausente');
      const mfa = mfaSatisfied(payload);
      req.principal = { sub: subject, issuer, mfa, claims: payload };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
