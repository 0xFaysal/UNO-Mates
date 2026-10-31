import {NextRequest} from 'next/server';
import {adminLoginSchema} from '@/lib/admin-contract';
import {ADMIN_COOKIE,adminDb,adminJson,adminSameOrigin,adminTokenHash,hashAdminToken,newAdminToken,setAdminCookie} from '@/lib/server/admin';
export async function POST(request:NextRequest){
 if(!adminSameOrigin(request))return adminJson({error:'Request not allowed.'},403);
 try{
  const parsed=adminLoginSchema.safeParse(await request.json());if(!parsed.success)return adminJson({error:'Enter your username and password.'},400);
  const token=newAdminToken();
  const address=process.env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim():'local';
  const {data,error}=await adminDb().rpc('uno_admin_sign_in',{p_username:parsed.data.username,p_password:parsed.data.password,p_ip_hash:hashAdminToken(address),p_token_hash:hashAdminToken(token)});
  if(error)throw error;
  if(!data.ok){const response=adminJson({error:data.limited?'Too many attempts. Try again in 15 minutes.':'Username or password is incorrect.'},data.limited?429:401);if(data.limited)response.headers.set('Retry-After','900');return response;}
  const response=adminJson({username:data.username});setAdminCookie(response,token);return response;
 }catch{return adminJson({error:'Sign-in is unavailable. Please try again.'},503);}
}
export async function DELETE(request:NextRequest){
 if(!adminSameOrigin(request))return adminJson({error:'Request not allowed.'},403);
 try{const token=await adminTokenHash();if(token){const {error}=await adminDb().rpc('uno_admin_sign_out',{p_token_hash:token});if(error)throw error;}const response=adminJson({ok:true});response.cookies.set(ADMIN_COOKIE,'',{path:'/',maxAge:0});return response;}
 catch{return adminJson({error:'Could not sign out. Please try again.'},503);}
}
