import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getSessionToken} from '@/lib/server/session';
import {getOrCreateVisitorHash} from '@/lib/server/visitor';
import {getSupabaseClient} from '@/lib/server/store';
import {LESSON_IDS} from '@/lib/learning-contract';
const schema=z.object({operation:z.enum(['status','progress','completed','skipped','experienced']).default('status'),lesson:z.number().int().min(0).max(LESSON_IDS.length).default(0),existing:z.boolean().default(false)});
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return NextResponse.json({error:'Invalid request'},{status:403,headers});
 try{
  const input=schema.safeParse(await request.json());if(!input.success)return NextResponse.json({error:'Invalid learning progress'},{status:400,headers});
  const guest=await getSessionToken(),hash=await getOrCreateVisitorHash(guest||'');
  const db=getSupabaseClient();if(!db)throw Error('Learning profile unavailable');
  const {data,error}=await db.rpc('uno_learning_profile',{p_hash:hash,p_operation:input.data.operation,p_lesson:input.data.lesson,p_existing:input.data.existing});if(error)throw error;
  return NextResponse.json(data,{headers});
 }catch{return NextResponse.json({error:'Progress could not sync. You can keep practising.'},{status:503,headers});}
}
