import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
interface LocalUIState {
 reactionsEnabled:boolean;toggleReactions:()=>void;
 soundEnabled:boolean; musicEnabled:boolean; musicVolume:number; vibrationEnabled:boolean; toggleSound:()=>void; toggleMusic:()=>void; setMusicVolume:(volume:number)=>void; toggleVibration:()=>void;
 isChatOpen:boolean;isSettingsOpen:boolean;isRulesOpen:boolean;setChatOpen:(open:boolean)=>void;setSettingsOpen:(open:boolean)=>void;setRulesOpen:(open:boolean)=>void;
 selectedCardId:string|null;setSelectedCardId:(id:string|null)=>void;isUnoArmed:boolean;setIsUnoArmed:(armed:boolean)=>void;
 isColorPickerOpen:boolean;colorPickerMode:'wild'|'draw4';openColorPicker:(mode:'wild'|'draw4')=>void;closeColorPicker:()=>void;
}
const safeStorage:StateStorage={
 getItem:name=>{try{return typeof window==='undefined'?null:window.localStorage.getItem(name);}catch{return null;}},
 setItem:(name,value)=>{try{if(typeof window!=='undefined')window.localStorage.setItem(name,value);}catch{/* Preferences are optional when storage is blocked. */}},
 removeItem:name=>{try{if(typeof window!=='undefined')window.localStorage.removeItem(name);}catch{/* Storage is optional. */}},
};
export const useGameStore=create<LocalUIState>()(persist(set=>({
 reactionsEnabled:true,toggleReactions:()=>set(s=>({reactionsEnabled:!s.reactionsEnabled})),
 soundEnabled:true,musicEnabled:true,musicVolume:.55,vibrationEnabled:true,
 toggleSound:()=>set(s=>({soundEnabled:!s.soundEnabled})),
 toggleMusic:()=>set(s=>({musicEnabled:!s.musicEnabled})),
 setMusicVolume:volume=>set({musicVolume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.55}),
 toggleVibration:()=>set(s=>({vibrationEnabled:!s.vibrationEnabled})),
 isChatOpen:false,isSettingsOpen:false,isRulesOpen:false,setChatOpen:open=>set({isChatOpen:open}),setSettingsOpen:open=>set({isSettingsOpen:open}),setRulesOpen:open=>set({isRulesOpen:open}),
 selectedCardId:null,setSelectedCardId:id=>set({selectedCardId:id}),isUnoArmed:false,setIsUnoArmed:armed=>set({isUnoArmed:armed}),
 isColorPickerOpen:false,colorPickerMode:'wild',openColorPicker:mode=>set({isColorPickerOpen:true,colorPickerMode:mode}),closeColorPicker:()=>set({isColorPickerOpen:false}),
}),{name:'uno-mates-settings',version:1,storage:createJSONStorage(()=>safeStorage),skipHydration:true,partialize:state=>({soundEnabled:state.soundEnabled,musicEnabled:state.musicEnabled,musicVolume:state.musicVolume,vibrationEnabled:state.vibrationEnabled,reactionsEnabled:state.reactionsEnabled})}));
