// lib/http/cors.ts
// CORS for the endpoints the browser extension calls from its own origin
// (app/api/extension/*). Open to every origin on purpose — and safe only
// because those endpoints never read cookies: a request carries a bearer token
// or, for sign-in, the password itself, so a page other than the extension
// gains nothing it did not already have.

export const OPEN_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS });
}

export function corsJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: OPEN_CORS_HEADERS });
}
