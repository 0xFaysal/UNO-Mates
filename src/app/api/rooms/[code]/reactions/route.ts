import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionToken} from '@/lib/server/session';
import {getSupabaseClient} from '@/lib/server/store';
import {errorMessage} from '@/lib/errors';
const schema=z.object({key:z.enum(['nice','laugh','oops','wow'])});
export async function POST(request:NextRequest,{params}:{params:Promise<{code:string}>}){
  const session=await getSessionToken();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Choose a table reaction.'},{status:400});
  const db=getSupabaseClient();
  if(!db)return NextResponse.json({error:'Live reactions are unavailable.'},{status:503});
  const {code}=await params;
  const {data,error}=await db.rpc('uno_table_reaction',{p_code:code,p_session:session,p_key:parsed.data.key});
  if(error)return NextResponse.json({error:errorMessage(error,'Could not send reaction.')},{status:error.message.includes('Wait')?429:403});
  return NextResponse.json({reaction:data});
}
