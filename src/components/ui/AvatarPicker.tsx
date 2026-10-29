import { Check } from 'lucide-react';
export const AVATAR_OPTIONS = [
  { value: '#ef4444', name: 'Coral' }, { value: '#f59e0b', name: 'Amber' },
  { value: '#10b981', name: 'Emerald' }, { value: '#3b82f6', name: 'Blue' },
  { value: '#8b5cf6', name: 'Violet' }, { value: '#ec4899', name: 'Pink' },
  { value: '#06b6d4', name: 'Cyan' }, { value: '#f97316', name: 'Orange' },
];
export const AVATAR_COLORS = AVATAR_OPTIONS.map(option => option.value);
export function AvatarPicker({ value, onChange, disabled = false }: { value: string; onChange: (color: string) => void; disabled?: boolean }) {
  return <fieldset className="avatar-field" disabled={disabled}><legend>Choose avatar color</legend><div className="avatar-picker">
    {AVATAR_OPTIONS.map(option => <button type="button" key={option.value} aria-label={'Avatar color: ' + option.name} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={value === option.value ? 'is-selected' : ''}><span style={{ backgroundColor: option.value }}>{value === option.value && <Check size={17} strokeWidth={3} aria-hidden="true" />}</span></button>)}
  </div></fieldset>;
}
