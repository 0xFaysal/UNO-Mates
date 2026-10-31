import type {Metadata} from 'next';
import {adminIdentity} from '@/lib/server/admin';
import {AdminDashboard} from '@/components/admin/AdminDashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Control room',robots:{index:false,follow:false}};
export default async function AdminPage(){
 let username:string|null=null,error:string|undefined;
 try{username=await adminIdentity();}catch{error='Admin access is unavailable. Please try again.';}
 return <AdminDashboard initialUsername={username} initialError={error}/>;
}
