const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

if (!c.includes('rumbleRoyaleGameHandler')) {
  c = c.replace(
    "const { handlePixxieBotMessage } = require('./games/hangryGamesHandler');",
    `const { handlePixxieBotMessage } = require('./games/hangryGamesHandler');
const { handleRumbleRoyaleMessage } = require('./games/rumbleRoyaleGameHandler');`
  );

  c = c.replace(
    "client.on('messageCreate', async message => {\n  try { await handlePixxieBotMessage(message); }\n  catch (err) { console.error('[Hangry Games]', err.message); }\n});",
    `client.on('messageCreate', async message => {
  try { await handlePixxieBotMessage(message); }
  catch (err) { console.error('[Hangry Games]', err.message); }
  try { await handleRumbleRoyaleMessage(message); }
  catch (err) { console.error('[Rumble Royale]', err.message); }
});`
  );

  fs.writeFileSync('src/index.js', c);
  console.log('Rumble Royale handler wired into index.js');
} else {
  console.log('Already wired');
}
