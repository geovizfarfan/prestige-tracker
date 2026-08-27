const fs = require('fs');
let h = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Ignore Orbit Tracker's own messages
h = h.replace(
  '  // Only process messages from bots (prevents manual text from triggering)\n  if (!message.author.bot) return;',
  `  // Only process messages from bots, ignore our own messages
  if (!message.author.bot) return;
  if (message.author.id === message.client.user.id) return;`
);

// Fix game start to also detect Part 2 with tributes
h = h.replace(
  `const isGameStart = fullText.includes("has started") && fullText.includes('Hangry Games') ||
    fullText.includes('The Battle Begins') ||
    (fullText.includes('tributes') && fullText.includes('Hangry Games')) ||
    (fullText.includes('Part 2') && fullText.includes('Battle'));`,
  `const isGameStart = 
    (fullText.includes('The Battle Begins') && fullText.includes('Hangry Games')) ||
    (fullText.includes('tributes') && fullText.includes('Hangry Games')) ||
    (fullText.includes('Part 2') && fullText.includes('Battle')) ||
    (fullText.includes('has started') && fullText.includes('Hangry Games') && fullText.includes('tributes'));`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', h);
console.log('done');
