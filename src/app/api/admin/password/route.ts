import {NextRequest} from 'next/server';
import {adminPasswordSchema} from '@/lib/admin-contract';
import {adminDb,adminJson,adminSameOrigin,adminTokenHash,hashAdminToken,newAdminToken,setAdminCookie} from '@/lib/server/admin';
export async function POST(request:NextRequest){
 if(!adminSameOrigin(request))return adminJson({error:'Request not allowed.'},403);
 try{
  const hash=await adminTokenHash();if(!hash)return adminJson({error:'Your session ended. Sign in again.'},401);
  const parsed=adminPasswordSchema.safeParse(await request.json());if(!parsed.success)return adminJson({error:parsed.error.issues[0].message},400);
  const token=newAdminToken();const {data,error}=await adminDb().rpc('uno_admin_change_password',{p_token_hash:hash,p_current:parsed.data.current,p_new:parsed.data.next,p_replacement_hash:hashAdminToken(token)});if(error)throw error;
  if(!data.ok)return adminJson({error:data.expired?'Your session ended. Sign in again.':data.limited?'Too many attempts. Try again in 15 minutes.':data.same?'Choose a different new password.':'Current password is incorrect.'},data.expired?401:data.limited?429:400);
  const response=adminJson({ok:true});setAdminCookie(response,token);return response;
 }catch{return adminJson({error:'Password was not changed. Please try again.'},503);}
}
