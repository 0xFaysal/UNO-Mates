import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {automaticTurn} from './game/automation.ts';
import type {ServerAuthoritativeState} from './game/types.ts';

// This endpoint is public at the gateway but accepts ONLY the private Vault token.
// The service key is supplied by Supabase's runtime and never returned or logged.
Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const token=request.headers.get('x-uno-clock');
  if(!token||token.length!==64)return new Response('Unauthorized',{status:401});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await db.rpc('uno_clock_authorized',{p_token:token});
  if(auth.error||auth.data!==true)return new Response('Unauthorized',{status:401});
  const body=await request.json().catch(()=>null);
  const ids=body?.roomIds;
  if(!Array.isArray(ids)||ids.length>16||!ids.every(id=>typeof id==='string'&&/^[\da-f-]{36}$/i.test(id)))return new Response('Invalid batch',{status:400});
  const {data:rows,error}=await db.from('game_states').select('room_id,version,public_state,secret_state').eq('status','playing').in('room_id',ids).or('clock_due_at.lte.'+Date.now()+',bot_catch_due_at.lte.'+Date.now());
  if(error)return new Response('Clock read unavailable',{status:503});
  let applied=0;
  try{
    // Bound simultaneous presence probes; no bot acts on an uncertain presence result.
    for(let offset=0;offset<(rows||[]).length;offset+=4){
      await Promise.all((rows||[]).slice(offset,offset+4).map(async(row)=>{
        const online=await new Promise<Set<string>|null>(resolve=>{
          let settled=false;
          const finish=(value:Set<string>|null)=>{if(settled)return;settled=true;clearTimeout(timer);void db.removeChannel(channel);resolve(value);};
          const channel=db.channel('room:'+row.room_id,{config:{private:true}})
            .on('presence',{event:'sync'},()=>finish(new Set(Object.keys(channel.presenceState()))));
          const timer=setTimeout(()=>finish(null),2500);
          channel.subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')finish(null);});
        });
        if(!online){
          await db.from('game_states').update({clock_dispatch_until:new Date(Date.now()+2000).toISOString()}).eq('room_id',row.room_id).eq('version',row.version);
          return;
        }
        const state:ServerAuthoritativeState={gameState:row.public_state,drawPile:row.secret_state.drawPile,playerHands:row.secret_state.playerHands};
        const next=automaticTurn(state,online);
        if(!next)return;
        const result=await db.from('game_states').update({version:next.gameState.version,status:next.gameState.status,public_state:next.gameState,secret_state:{drawPile:next.drawPile,playerHands:next.playerHands},clock_dispatch_until:null}).eq('room_id',row.room_id).eq('version',row.version).select('version');
        if(!result.error&&result.data?.length)applied++;
      }));
    }
  }finally{await db.removeAllChannels();}
  return Response.json({applied});
});
