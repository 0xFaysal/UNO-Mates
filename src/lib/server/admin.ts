import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {getSupabaseClient} from './store';
import {sessionCookieIsSecure} from './cookie-policy';
import type {AdminStats,LiveTable} from '../admin-contract';

export const ADMIN_COOKIE='uno_admin_session';
export const adminHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Vary':'Cookie'};
export const hashAdminToken=(value:string)=>createHash('sha256').update(value).digest('hex');
export const newAdminToken=()=>randomBytes(32).toString('hex');
export function adminDb(){const db=getSupabaseClient();if(!db)throw new Error('Admin database unavailable');return db;}
export async function adminTokenHash(){const token=(await cookies()).get(ADMIN_COOKIE)?.value;return token&&/^[a-f0-9]{64}$/.test(token)?hashAdminToken(token):null;}
export async function adminIdentity(){const token=await adminTokenHash();if(!token)return null;const {data,error}=await adminDb().rpc('uno_admin_identity',{p_token_hash:token});if(error)throw error;return data as string|null;}
export function adminJson(value:unknown,status=200){return NextResponse.json(value,{status,headers:adminHeaders});}
export function adminSameOrigin(request:NextRequest){return request.headers.get('origin')===request.nextUrl.origin&&request.headers.get('content-type')?.split(';')[0]==='application/json';}
export function setAdminCookie(response:NextResponse,token:string){response.cookies.set(ADMIN_COOKIE,token,{httpOnly:true,secure:sessionCookieIsSecure({nodeEnv:process.env.NODE_ENV,allowLocalHttp:process.env.UNO_ALLOW_LOCAL_HTTP,vercel:process.env.VERCEL}),sameSite:'strict',path:'/',maxAge:8*60*60});}

interface Candidate {id:string;code:string;status:string;started:string|null;bots:number;humans:string[]}
/** Actual private-channel Presence, not stale players.is_online values. Admin traffic only. */
export async function readAdminStats(days:number,signal:AbortSignal):Promise<AdminStats>{
 const {data,error}=await adminDb().rpc('uno_admin_dashboard',{p_days:days});if(error)throw error;
 const {candidates,...stats}=data as Omit<AdminStats,'checkedAt'|'live'>&{candidates:Candidate[]};
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const tables:LiveTable[]=[];let failed=0;
 const batch=candidates.slice(0,40);
 try{
  for(let offset=0;offset<batch.length;offset+=5){
   if(signal.aborted)throw new Error('Request cancelled');
   await Promise.all(batch.slice(offset,offset+5).map(async room=>{
    const online=await new Promise<Set<string>|null>(resolve=>{
     let settled=false;
     const finish=(value:Set<string>|null)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);void client.removeChannel(channel);resolve(value);};
     const cancel=()=>finish(null);
     const channel=client.channel('room:'+room.id,{config:{private:true}}).on('presence',{event:'sync'},()=>finish(new Set(Object.keys(channel.presenceState()))));
     const timer=setTimeout(()=>finish(null),2000);signal.addEventListener('abort',cancel,{once:true});
     channel.subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')finish(null);});
    });
    if(!online){failed++;return;}
    const humans=room.humans.filter(id=>online.has(id)).length;
    if(humans)tables.push({code:room.code,status:room.status,online:humans,bots:room.bots,started:room.started&&Number.isFinite(Number(room.started))?Number(room.started):null});
   }));
  }
 }finally{await client.removeAllChannels();}
 const games=tables.filter(room=>room.status!=='lobby');
 return {...stats,checkedAt:new Date().toISOString(),live:{players:tables.reduce((sum,room)=>sum+room.online,0),games:games.length,waiting:tables.length-games.length,bots:games.reduce((sum,room)=>sum+room.bots,0),checked:batch.length,failed,truncated:candidates.length>40,tables:tables.sort((a,b)=>b.online-a.online)}};
}
