import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, SessionPayload } from '../types/app.types.js';
import type { Context } from 'hono';

import {
  APP_SESSION_COOKIE_NAME,
  APP_SESSION_MAX_AGE_SECONDS,
  getCookieSecret,
} from '../config/auth.config.js';

export async function createSessionToken(): Promise<string> {
  const payload: SessionPayload = {
    authenticated: true,
    createdAt: Date.now(),
  };
  const data = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSign(data, getCookieSecret());
  return `${data}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [data, signature] = token.split('.');
  if (!data || !signature) {
    return null;
  }

  const expectedSignature = await hmacSign(data, getCookieSecret());
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(data)) as Partial<SessionPayload>;
    if (payload.authenticated !== true || typeof payload.createdAt !== 'number') {
      return null;
    }

    const ageSeconds = (Date.now() - payload.createdAt) / 1000;
    if (ageSeconds > APP_SESSION_MAX_AGE_SECONDS) {
      return null;
    }

    return {
      authenticated: true,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}

export function getSessionToken(c: Context<AppEnv>): string | undefined {
  return getCookie(c, APP_SESSION_COOKIE_NAME);
}

export function setSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, APP_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: APP_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'Lax',
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, APP_SESSION_COOKIE_NAME, { path: '/' });
}

export async function constantTimeStringEqual(a: string, b: string): Promise<boolean> {
  const signatureA = await hmacSign('llaab-auth-check', a);
  const signatureB = await hmacSign('llaab-auth-check', b);
  return constantTimeEqual(signatureA, signatureB);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return base64UrlEncodeBytes(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
