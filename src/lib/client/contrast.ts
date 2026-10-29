function luminance(hex:string):number|null {
 const channels=hex.replace('#','').match(/.{2}/g)?.map(value=>parseInt(value,16)/255);
 if(!channels||channels.length!==3||channels.some(Number.isNaN))return null;
 const [r,g,b]=channels.map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
 return .2126*r+.7152*g+.0722*b;
}
/** Preserve the palette where possible, with an AA-safe fallback for custom colors. */
export function contrastText(hex:string):'#071511'|'#ffffff'|'#000000'{
 const value=luminance(hex);if(value===null)return '#ffffff';
 const dark=(value+.05)/(luminance('#071511')!+.05);const light=1.05/(value+.05);
 if(dark>=4.5&&dark>=light)return '#071511';if(light>=4.5)return '#ffffff';return '#000000';
}
