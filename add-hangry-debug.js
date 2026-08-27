const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

c = c.replace(
  'if (message.author.id !== tracker.PIXXIEBOT_ID) return;',
  'console.log("[Hangry] msg from:", message.author.id, "in:", message.channelId);\n  if (message.author.id !== tracker.PIXXIEBOT_ID) return;'
);

c = c.replace(
  'if (!channels.includes(channelId)) return;',
  'console.log("[Hangry] registered:", channels, "this:", channelId);\n  if (!channels.includes(channelId)) return;'
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('Debug logging added');
