const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Log fullText content when it's not empty
c = c.replace(
  '  console.log("[Hangry] Processing message from", message.author.username, "| text:", fullText.slice(0, 100));',
  '  console.log("[Hangry] Processing from", message.author.username, "| fullText:", fullText.slice(0, 150));'
);

// If that line doesn't exist, add it after fullText assignment
if (!c.includes('[Hangry] Processing from')) {
  c = c.replace(
    '  if (!fullText.trim()) {',
    '  console.log("[Hangry] GOT MSG from", message.author.username, "full:", fullText.slice(0,150));\n  if (!fullText.trim()) {'
  );
}

// Add log for active game check
c = c.replace(
  '  const game = tracker.getGame(channelId);\n  if (!game) {',
  `  const game = tracker.getGame(channelId);
  console.log('[Hangry] Active game in channel:', channelId, '=', game ? 'YES session:' + game.sessionId : 'NO');
  if (!game) {`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
