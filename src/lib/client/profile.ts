export function readProfile(): { name: string; color: string | null } {
  try { return { name: localStorage.getItem('uno_nickname') || '', color: localStorage.getItem('uno_avatar_color') }; }
  catch { return { name: '', color: null }; }
}
export function saveProfile(name: string, color: string) {
  try { localStorage.setItem('uno_nickname',name); localStorage.setItem('uno_avatar_color',color); }
  catch { /* Private browsing or blocked storage must not prevent joining a game. */ }
}
