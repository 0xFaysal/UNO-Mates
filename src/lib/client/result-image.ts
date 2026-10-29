import { rankedPlayers, type ResultGame } from '@/lib/game/results';
import { contrastText } from './contrast';

/** Public results only: no hand, room invitation or session appears in the PNG. */
export async function createResultImage(game: ResultGame): Promise<File> {
  await document.fonts.ready;
  const players = rankedPlayers(game), canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 610 + players.length * 104;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image export is unavailable in this browser.');
  const font = getComputedStyle(document.body).fontFamily;
  const theme=getComputedStyle(document.documentElement);
  const background=theme.getPropertyValue('--background').trim(), panel=theme.getPropertyValue('--brand-panel').trim();
  const gold=theme.getPropertyValue('--brand-gold').trim(), foreground=theme.getPropertyValue('--foreground').trim(), muted=theme.getPropertyValue('--brand-muted').trim();
  const text = (value: string, x: number, y: number, size: number, color: string, weight = 600, maxWidth?: number) => {
    context.fillStyle = color; context.font = `${weight} ${size}px ${font}`;
    while (maxWidth && context.measureText(value).width > maxWidth && size > 20) context.font = `${weight} ${--size}px ${font}`;
    context.fillText(value,x,y);
  };
  const box = (x: number,y: number,width: number,height: number,radius: number,color: string) => {
    context.fillStyle=color; context.beginPath(); context.roundRect(x,y,width,height,radius); context.fill();
  };
  context.fillStyle=background; context.fillRect(0,0,canvas.width,canvas.height);
  box(24,24,1032,canvas.height-48,34,panel);
  try { const logo = new Image(); logo.src='/brand/uno-mates-mark.webp'; await logo.decode(); context.drawImage(logo,66,66,82,82); }
  catch { text('M',84,127,56,gold,900); }
  text('UNO Mates',168,119,38,foreground,850);
  text('THE TABLE HAS A CHAMPION',70,204,22,gold,750);
  text(players[0]?.name || 'Round complete',70,284,66,foreground,850,935);
  text('First to finish. A win worth sharing.',72,333,27,muted);
  text('FINAL RANKINGS',72,415,22,muted,750);
  players.forEach((player,index) => {
    const y=442+index*104;
    box(64,y,952,88,18,index===0?'#343b23':'#20332a');
    text('#'+(index+1),86,y+55,30,index===0?gold:muted,850);
    box(168,y+17,54,54,27,player.avatarColor);
    text(Array.from(player.name)[0]?.toUpperCase() || '?',184,y+54,28,contrastText(player.avatarColor),750);
    text(player.name,246,y+39,30,foreground,750,710);
    text(index===0?'Table champion':index===players.length-1&&players.length===game.players.length?'Last remaining · '+player.cardCount+(player.cardCount===1?' card':' cards'):'Hand completed',246,y+67,21,muted);
  });
  text('YOUR MATES. YOUR TABLE.',72,canvas.height-85,22,gold,750);
  text(new URL(window.location.origin).host,72,canvas.height-49,22,muted);
  const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create your result image. Try again.')), 'image/png'));
  return new File([blob],'uno-mates-results.png',{type:'image/png'});
}
export function downloadResultImage(file: File): void {
  const url=URL.createObjectURL(file), link=document.createElement('a');
  link.href=url; link.download=file.name; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
