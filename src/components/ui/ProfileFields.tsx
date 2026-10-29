import { AvatarPicker } from './AvatarPicker';
export function ProfileFields({ nickname, onNicknameChange, color, onColorChange, disabled, prefix, descriptionId }: { nickname: string; onNicknameChange: (value: string) => void; color: string; onColorChange: (value: string) => void; disabled?: boolean; prefix: string; descriptionId?: string }) {
  return <div className="space-y-4">
    <div className="profile-field"><label htmlFor={prefix + '-nickname'} className="block mb-2">Your nickname</label><input id={prefix + '-nickname'} name="nickname" type="text" autoComplete="nickname" value={nickname} onChange={event => onNicknameChange(event.target.value)} placeholder="Your table nickname" maxLength={20} disabled={disabled} aria-describedby={descriptionId} className="w-full bg-slate-950 text-white font-semibold px-4 py-3 rounded-2xl border border-slate-700" /></div>
    <AvatarPicker value={color} onChange={onColorChange} disabled={disabled} />
  </div>;
}
