const fs = require('fs');
let c = fs.readFileSync('src/utils/bountyEmbeds.js', 'utf8');

// Fix duplicate - remove TYPE_BADGES from the display line, keep only typeLabel
c = c.replaceAll(
  '`**#${b.id} — ${TYPE_BADGES[b.type] || b.type}** ${typeLabel}`',
  '`**#${b.id} — ${typeLabel}**`'
);

c = c.replaceAll(
  '`**#${bounty.id} — ${TYPE_BADGES[bounty.type] || bounty.type}** ${typeLabel}\\n`',
  '`**#${bounty.id} — ${typeLabel}**\\n`'
);

fs.writeFileSync('src/utils/bountyEmbeds.js', c);
console.log('done');
