import {NextRequest} from 'next/server';
import {adminIdentity,adminJson,readAdminStats} from '@/lib/server/admin';
export const maxDuration=45;
export async function GET(request:NextRequest){
 try{
  if(!await adminIdentity())return adminJson({error:'Your session ended. Sign in again.'},401);
  const days=Number(request.nextUrl.searchParams.get('days')||7);if(![7,30].includes(days))return adminJson({error:'Choose 7 or 30 days.'},400);
  return adminJson(await readAdminStats(days,request.signal));
 }catch{return adminJson({error:'Could not refresh statistics. Please try again.'},503);}
}
