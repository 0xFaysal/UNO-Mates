/** Prefer the modern clipboard, retaining a user-triggered fallback for LAN HTTP and older phones. */
export async function copyText(text:string):Promise<void>{
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{/* Fall back when permission is unavailable. */}}
 const previous=document.activeElement;
 const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.setAttribute('aria-label','Copy text');
 Object.assign(field.style,{position:'fixed',top:'0',left:'0',width:'1px',height:'1px',opacity:'0'});
 document.body.appendChild(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);
 try{if(typeof document.execCommand!=='function'||!document.execCommand('copy'))throw new Error('Copy is unavailable. Select and copy the text manually.');}
 finally{field.remove();if(previous instanceof HTMLElement)previous.focus({preventScroll:true});}
}
