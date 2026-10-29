import { HOUSE_RULES } from '@/lib/game/house-rules';
export function HouseRulesContent() {
  return <div className="space-y-4 text-sm text-slate-300">{HOUSE_RULES.map(rule => <section key={rule.title} className="space-y-1"><h2 className="font-bold text-yellow-400">{rule.title}</h2><p>{rule.text}</p></section>)}</div>;
}
