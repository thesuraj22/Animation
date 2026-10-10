import { NextResponse, type NextRequest } from 'next/server';
export function proxy(_request: NextRequest) { const response = NextResponse.next(); response.headers.set('X-Content-Type-Options', 'nosniff'); response.headers.set('Referrer-Policy', 'same-origin'); response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); return response; }
export const config = { matcher: ['/((?!_next/static|assets|fonts|favicon.svg).*)'] };
