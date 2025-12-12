import jwt from 'jsonwebtoken';
import getJwtSecret from './getJwtSecret.js';

const SECRET = getJwtSecret();
const ACCESS_TOKEN_EXPIRATION = '1h';
const REFRESH_TOKEN_EXPIRATION = '7d';

export function signToken(payload, opts = {}) {
  const options = { expiresIn: REFRESH_TOKEN_EXPIRATION, ...opts };
  return jwt.sign(payload, SECRET, options);
}

export function signAccessToken(payload, opts = {}) {
  const options = { expiresIn: ACCESS_TOKEN_EXPIRATION, ...opts };
  return jwt.sign({ ...payload, tokenType: 'access' }, SECRET, options);
}

export function signRefreshToken(payload, opts = {}) {
  const options = { expiresIn: REFRESH_TOKEN_EXPIRATION, ...opts };
  return jwt.sign({ ...payload, tokenType: 'refresh' }, SECRET, options);
}

export function verifyToken(token, expectedType) {
  const decoded = jwt.verify(token, SECRET);
  if (expectedType && decoded.tokenType !== expectedType) {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded;
}

export function verifyAccessToken(token) {
  return verifyToken(token, 'access');
}

export function verifyRefreshToken(token) {
  return verifyToken(token, 'refresh');
}

export function decodeToken(token) {
  return jwt.decode(token);
}

export { getJwtSecret, ACCESS_TOKEN_EXPIRATION, REFRESH_TOKEN_EXPIRATION };
