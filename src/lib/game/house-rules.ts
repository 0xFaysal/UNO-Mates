export const HOUSE_RULES = [
  {title:'Empty tables',text:'At least one person must stay connected. If everyone goes offline, play stops while the connection is checked for 15 seconds. If nobody returns, the match closes permanently. Bot seats do not keep a table running.'},
  {title:'20-second turns',text:'You have 20 seconds to act. If time runs out, draw one card and pass. If you already drew a playable card, just pass without drawing again. A pending +2/+4 stack is drawn in full instead of that one card. Drawing a playable card does not reset the timer. After two consecutive missed offline turns, auto-play takes over using only your own hand. Return to the table to take control again.'},
  { title: 'Winning', text: 'Empty your hand to earn your finishing rank, then spectate. Play continues until one player remains; they take last place. The final dashboard shows everyone’s rank. No points. Your final card must be a number from 0 to 9; no Skip, Reverse, Wild, +2 or +4 finish.' },
  { title: 'Matching cards', text: 'Match the active color, number or action symbol. Each player starts with 7 cards.' },
  { title: 'Stacking +2 and +4', text: 'On a pending +2, play any color +2 or a +4. On a pending +4, only another +4 is allowed. No Skip, Reverse, Wild or number card can block a penalty.' },
  { title: 'Taking the penalty', text: 'Stack another allowed card or draw the full accumulated total and miss your turn. Example: +2, +2, +4 means draw 8. Once the penalty is taken, normal matching resumes.' },
  { title: 'Wild and +4', text: 'Choose the next color. You may play +4 even if you hold the active color. Official +4 challenges are disabled.' },
  { title: 'Skip and Reverse', text: 'Skip misses the next turn. Reverse changes direction; with two players it acts as Skip.' },
  { title: 'Drawing', text: 'Normally draw one card. You may play only that new card or pass. If your only card is a power card, draw instead of finishing with it.' },
  { title: 'Calling UNO', text: 'Declare UNO when playing down to one card. If caught before the next action, draw two penalty cards. A seat marked “1 card” has not necessarily called UNO; “UNO!” confirms a declaration.' },
];
