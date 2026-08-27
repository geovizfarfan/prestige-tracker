const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');
c = c.replace(
  'if (!fullText.trim()) return;',
  'if (!fullText.trim()) { if (message.embeds.length) console.log("[Hangry] Empty embed struct:", JSON.stringify(message.embeds[0]).slice(0,300)); return; }'
);
fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
