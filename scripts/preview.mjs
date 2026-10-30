import {spawn} from 'node:child_process';
if(process.env.VERCEL==='1')throw new Error('Local HTTP preview cannot run as a Vercel deployment.');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start',...process.argv.slice(2)],{
 stdio:'inherit',windowsHide:true,env:{...process.env,UNO_ALLOW_LOCAL_HTTP:'true'},
});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
