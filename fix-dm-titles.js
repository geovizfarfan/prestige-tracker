const fs = require('fs');

// Fix submission DM title in addbounty.js
let a = fs.readFileSync('src/commands/bounties/addbounty.js', 'utf8');
a = a.replace(
  ".setTitle('🔍  Bounty Submitted!')",
  ".setTitle(`🔍  ${session.name} — Bounty Submitted!`)"
);
fs.writeFileSync('src/commands/bounties/addbounty.js', a);

// Fix approval DM title in bountyButtonHandler.js
let b = fs.readFileSync('src/interactions/bountyButtonHandler.js', 'utf8');
b = b.replace(
  ".setTitle(`${E.sparkle}  Bounty #${id} Approved!`)",
  ".setTitle(`${E.sparkle}  ${session?.name || 'Bounty'} — #${id} Approved!`)"
);
// Fix rejection DM title too
b = b.replace(
  ".setTitle(`❌  Bounty #${id} Rejected`)",
  ".setTitle(`❌  Bounty #${id} Rejected`)"
);
fs.writeFileSync('src/interactions/bountyButtonHandler.js', b);

console.log('done');
