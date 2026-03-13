import { isIP } from 'node:net';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = octets as [number, number, number, number];

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateNetworkHostname(hostname: string) {
  if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
    return true;
  }

  if (isIP(hostname) === 4) {
    return isPrivateIpv4(hostname);
  }

  if (isIP(hostname) === 6) {
    return hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd');
  }

  // Docker Compose service names are typically single-label hostnames like "web" or "api".
  return /^[a-z0-9][a-z0-9-]*$/i.test(hostname);
}

function parseAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN?.trim();
  const publicAppOrigin = process.env.APP_ORIGIN?.trim();
  const fallbackOrigins = publicAppOrigin
    ? [publicAppOrigin, ...DEFAULT_ALLOWED_ORIGINS]
    : DEFAULT_ALLOWED_ORIGINS;

  return (configuredOrigins ?? fallbackOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(origin?: string | null) {
  if (!origin) {
    return true;
  }

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  if ((process.env.ALLOW_PRIVATE_NETWORK_CORS ?? 'true') === 'false') {
    return false;
  }

  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && isPrivateNetworkHostname(url.hostname);
  } catch {
    return false;
  }
}

export function getAllowedCorsOrigin(origin?: string | null) {
  if (!origin) {
    return undefined;
  }

  return isAllowedCorsOrigin(origin) ? origin : undefined;
}
