import { auth } from 'express-oauth2-jwt-bearer';

export const jwtCheck = auth({
  audience: process.env['AUTH0_AUDIENCE'],
  issuerBaseURL: `https://${process.env['AUTH0_DOMAIN']}`,
  tokenSigningAlg: 'RS256',
});
