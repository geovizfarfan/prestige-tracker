const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Add bot-only filter after the channel check
c = c.replace(
  "  // Any bot can post Hangry Games content - we filter by content patterns instead\n",
  `  // Only process messages from bots (prevents manual text from triggering)
  if (!message.author.bot) return;

`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
