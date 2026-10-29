import {readFileSync} from 'node:fs';
const files=[{name:'index.ts',content:readFileSync('supabase/functions/uno-clock/index.ts','utf8')}];
for(const name of ['types','deck','engine','turn-clock','presentation','automation']){
  const content=readFileSync('src/lib/game/'+name+'.ts','utf8').replace(/from '(\.\/[^']+)'/g,(_all,path)=>"from '"+path+".ts'");
  files.push({name:'game/'+name+'.ts',content});
}
// The worker runs the exact shared engine. No second SQL implementation of game rules.
process.stdout.write(JSON.stringify(files));
