import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { IncomingMessage } from 'http';

export interface Principal { sub: string; issuer: string; mfa: boolean; claims: JWTPayload; }
export type AuthenticatedRequest = IncomingMessage & { principal: Principal; headers: IncomingMessage['headers'] };

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
      if (!payload.sub || typeof payload.sub !== 'string') throw new UnauthorizedException('Sujeito ausente');
      const amr = Array.isArray(payload.amr) ? payload.amr : [];
      const acr = typeof payload.acr === 'string' ? payload.acr : '';
      // MFA deve ser mapeado aos claims do provedor homologado. Nunca inferir por e-mail.
      const mfa = amr.some(v => ['mfa','otp','webauthn','hwk'].includes(String(v))) || (process.env.OIDC_MFA_ACR || '').split(',').filter(Boolean).includes(acr);
      req.principal = { sub: payload.sub, issuer, mfa, claims: payload };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
