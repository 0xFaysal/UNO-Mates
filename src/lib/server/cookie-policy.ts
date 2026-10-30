/** An explicit, local-only preview opt-in; deployed production cookies stay HTTPS-only. */
export function sessionCookieIsSecure({nodeEnv,allowLocalHttp,vercel}:{nodeEnv?:string;allowLocalHttp?:string;vercel?:string}){
 return nodeEnv==='production'&&!(allowLocalHttp==='true'&&vercel!=='1');
}
