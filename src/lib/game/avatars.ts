const CHARACTERS=['🐼','🦊','🐯','🐸','🐱','🐨','🐧','🐻','🐰','🦁'];
/** The lobby and game share the same friendly character for a nickname. */
export function playerCharacter(name:string):string {
 return CHARACTERS[name.split('').reduce((sum,character)=>sum+character.charCodeAt(0),0)%CHARACTERS.length];
}
