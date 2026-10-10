import { timingSafeEqual } from 'node:crypto';
import { httpError } from '../planner.js';

// One shared bearer token from the environment; the login password is the token itself.
// Without ADMIN_TOKEN the admin API is disabled.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const notConfigured = () => httpError(503, 'ADMIN_TOKEN not configured');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function login(password) {
  if (!ADMIN_TOKEN) throw notConfigured();
  if (!password || !safeEqual(password, ADMIN_TOKEN)) throw httpError(401, 'Invalid password');
  return { token: ADMIN_TOKEN };
}

export function requireAdmin(req, _res, next) {
  if (!ADMIN_TOKEN) return next(notConfigured());
  const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
  if (!m || !safeEqual(m[1].trim(), ADMIN_TOKEN)) return next(httpError(401, 'Admin token required'));
  next();
}
