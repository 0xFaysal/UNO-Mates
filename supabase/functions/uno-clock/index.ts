import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {automaticTurn,resolveTablePresence} from './game/automation.ts';
import type {ServerAuthoritativeState} from './game/types.ts';

// This endpoint is public at the gateway but accepts ONLY the private Vault token.
// The service key is supplied by Supabase's runtime and never returned or logged.
Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const token=request.headers.get('x-uno-clock');
  if(!token||token.length!==64)return new Response('Unauthorized',{status:401});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await request.json().catch(()=>null);
  const ids=body?.roomIds;
  if(!Array.isArray(ids)||ids.length>16||!ids.every(id=>typeof id==='string'&&/^[\da-f-]{36}$/i.test(id)))return new Response('Invalid batch',{status:400});
  const {data:work,error}=await db.rpc('uno_clock_work',{p_token:token,p_ids:ids});
  if(error)return new Response('Clock read unavailable',{status:503});
  if(work?.authorized!==true)return new Response('Unauthorized',{status:401});
  const rows=work.rows as {room_id:string;version:number;public_state:ServerAuthoritativeState['gameState'];secret_state:Pick<ServerAuthoritativeState,'drawPile'|'playerHands'>}[];
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
        const next=resolveTablePresence(state,online)||automaticTurn(state,online);
        if(!next||next===state)return;
        if(next.gameState.endReason==='all_offline'){
          const closed=await db.rpc('uno_close_abandoned_match',{p_room_id:row.room_id,p_expected_version:row.version,p_state:next.gameState});
          if(!closed.error&&closed.data===true)applied++;
          return;
        }
        const result=await db.from('game_states').update({version:next.gameState.version,status:next.gameState.status,public_state:next.gameState,secret_state:{drawPile:next.drawPile,playerHands:next.playerHands},clock_dispatch_until:null}).eq('room_id',row.room_id).eq('version',row.version).select('version');
        if(!result.error&&result.data?.length)applied++;
      }));
    }
  }finally{await db.removeAllChannels();}
  return Response.json({applied});
});
