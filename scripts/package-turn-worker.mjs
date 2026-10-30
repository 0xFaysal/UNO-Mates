import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const files=[{name:'index.ts',content:readFileSync('supabase/functions/uno-clock/index.ts','utf8')}];
for(const name of ['types','bots','deck','engine','turn-clock','presentation','automation']){
  const content=readFileSync('src/lib/game/'+name+'.ts','utf8').replace(/from '(\.\/[^']+)'/g,(_all,path)=>"from '"+path+".ts'");
  files.push({name:'game/'+name+'.ts',content});
}
// The worker runs the exact shared engine. No second SQL implementation of game rules.
if(process.argv.includes('--write')){
  for(const file of files){const path='supabase/functions/uno-clock/'+file.name;mkdirSync(dirname(path),{recursive:true});writeFileSync(path,file.content);}
  process.stdout.write('Prepared uno-clock with the current shared game engine.\n');
}else process.stdout.write(JSON.stringify(files));
