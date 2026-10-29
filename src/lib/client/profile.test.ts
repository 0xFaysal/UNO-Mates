import { afterEach, describe, expect, it, vi } from 'vitest';
import { readProfile, saveProfile } from './profile';
import { contrastText } from './contrast';
afterEach(()=>vi.unstubAllGlobals());
describe('Resilient profile and avatar presentation',()=>{
 it('keeps room entry available when browser storage is blocked',()=>{vi.stubGlobal('localStorage',{getItem(){throw new Error('Blocked');},setItem(){throw new Error('Blocked');}});expect(readProfile()).toEqual({name:'',color:null});expect(()=>saveProfile('CardNinja','#ef4444')).not.toThrow();});
 it('restores a saved name and avatar',()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)});saveProfile('MangoBandit','#f59e0b');expect(readProfile()).toEqual({name:'MangoBandit',color:'#f59e0b'});});
 it('chooses contrasting text for light and dark avatars',()=>{expect(contrastText('#ffffff')).toBe('#071511');expect(contrastText('#000000')).toBe('#ffffff');expect(contrastText('#f59e0b')).toBe('#071511');expect(contrastText('#5555ff')).toBe('#ffffff');expect(contrastText('invalid')).toBe('#ffffff');});
});
