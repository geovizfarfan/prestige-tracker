const fs = require('fs');
let h = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Fix 1: Ignore own messages
if (!h.includes('message.client.user.id')) {
  h = h.replace(
    '  if (!message.author.bot) return;',
    '  if (!message.author.bot) return;\n  if (message.author.id === message.client.user.id) return;'
  );
}

// Fix 2: Better game start detection
h = h.replace(
  `  if ((fullText.includes("has started THE BOARD PRINCESS's") || fullText.includes('The Battle Begins')) && fullText.includes('tributes')) {`,
  `  const isGameStart =
    (fullText.includes('The Battle Begins') && (fullText.includes('tributes') || fullText.includes('Hangry Games'))) ||
    (fullText.includes('Part 2') && fullText.includes('Battle')) ||
    (fullText.includes('tributes') && fullText.includes('Hangry Games')) ||
    (fullText.includes('has started') && fullText.includes('Hangry Games'));
  if (isGameStart) {`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', h);
console.log('done');
