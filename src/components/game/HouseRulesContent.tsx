import { HOUSE_RULES } from '@/lib/game/house-rules';
export function HouseRulesContent({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return <div className="space-y-4 text-sm text-slate-300">{HOUSE_RULES.map(rule => <section key={rule.title} className="space-y-1"><Heading className="font-bold text-yellow-400">{rule.title}</Heading><p>{rule.text}</p></section>)}</div>;
}
