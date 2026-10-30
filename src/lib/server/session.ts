import { cookies } from 'next/headers';
import crypto from 'crypto';
import {sessionCookieIsSecure} from './cookie-policy';

export const SESSION_COOKIE_NAME = 'uno_guest_session';

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie ? cookie.value : null;
}

export async function setSessionToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessionCookieIsSecure({nodeEnv:process.env.NODE_ENV,allowLocalHttp:process.env.UNO_ALLOW_LOCAL_HTTP,vercel:process.env.VERCEL}),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}
