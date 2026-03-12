import { FastifyRequest } from 'fastify';

export function shouldUseSecureCookie(request: FastifyRequest) {
  const configured = process.env.SESSION_COOKIE_SECURE;
  if (configured === 'true') {
    return true;
  }
  if (configured === 'false') {
    return false;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0]?.trim() === 'https';
  }

  return false;
}
