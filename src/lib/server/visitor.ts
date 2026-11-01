import 'server-only';
import {cookies} from 'next/headers';
import {createHash,randomBytes} from 'node:crypto';
import {sessionCookieIsSecure} from './cookie-policy';
import {getSupabaseClient} from './store';

export const VISITOR_COOKIE='uno_analytics_visitor';
/** An analytics identity, never an authorization credential. Existing guests keep continuity. */
export async function linkAnalyticsVisitor(playerId:string,guestToken:string){
 const jar=await cookies(),saved=jar.get(VISITOR_COOKIE)?.value;
 const hash=saved&&/^v1_[a-f0-9]{64}$/.test(saved)?saved.slice(3):createHash('sha256').update('uno-audience:'+(/^[a-f0-9]{64}$/.test(guestToken)?guestToken:randomBytes(32).toString('hex'))).digest('hex');
 // Persist only the one-way pseudonym, never the room's authentication token.
 jar.set(VISITOR_COOKIE,'v1_'+hash,{httpOnly:true,secure:sessionCookieIsSecure({nodeEnv:process.env.NODE_ENV,allowLocalHttp:process.env.UNO_ALLOW_LOCAL_HTTP,vercel:process.env.VERCEL}),sameSite:'lax',path:'/',maxAge:365*24*60*60});
 // Analytics must not prevent a valid room join. The DB has a guest-hash fallback.
 const db=getSupabaseClient();if(!db)return;
 const {error}=await db.from('players').update({visitor_hash:hash}).eq('id',playerId).eq('session_token',guestToken);
 if(error)console.warn('Could not link anonymous visitor analytics.');
}
