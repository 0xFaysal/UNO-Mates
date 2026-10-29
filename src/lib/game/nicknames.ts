export const FUNNY_NAMES = ['Fuchka Boss', 'Cha Ninja', 'Ghum Raja', 'Jhal Muri', 'Biscuit Bandit', 'Chill Panda', 'Mango Mafia', 'Potato King', 'Noodle Ninja', 'Lassi Legend', 'Jilapi Genius', 'Biryani Bandit', 'Toast Ghost', 'Doi Detective', 'Puchka Pirate', 'Chips Champion', 'Lazy Lizard', 'Spicy Penguin', 'Waffle Wizard', 'Cookie Captain'];
export function chooseNickname(input: string, taken: string[] = [], random = Math.random): string {
 const name = input.trim().slice(0,20);
 const generic = !name || /^(player(\s*\d+)?|host)$/i.test(name);
 if (!generic && !taken.some(n => n.toLowerCase() === name.toLowerCase())) return name;
 const free = FUNNY_NAMES.filter(n => !taken.some(t => t.toLowerCase() === n.toLowerCase()));
 return free[Math.floor(random() * free.length)] || 'Mystery Mango';
}
