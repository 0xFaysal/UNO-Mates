import {expect,it} from 'vitest';
import {sessionCookieIsSecure} from './cookie-policy';
it('requires secure cookies in production by default',()=>{expect(sessionCookieIsSecure({nodeEnv:'production'})).toBe(true);});
it('allows only explicitly enabled local HTTP previews',()=>{expect(sessionCookieIsSecure({nodeEnv:'production',allowLocalHttp:'true'})).toBe(false);expect(sessionCookieIsSecure({nodeEnv:'production',allowLocalHttp:'false'})).toBe(true);});
it('never disables secure cookies on Vercel, including accidental preview flags',()=>{expect(sessionCookieIsSecure({nodeEnv:'production',allowLocalHttp:'true',vercel:'1'})).toBe(true);});
it('preserves local development cookies',()=>{expect(sessionCookieIsSecure({nodeEnv:'development'})).toBe(false);});
