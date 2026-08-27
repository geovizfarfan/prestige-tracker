const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

if (!c.includes('messageUpdate')) {
  c = c.replace(
    "client.on('messageCreate', async message => {\n  try { await handlePixxieBotMessage(message); }\n  catch (err) { console.error('[Hangry Games]', err.message); }\n  try { await handleRumbleRoyaleMessage(message); }\n  catch (err) { console.error('[Rumble Royale]', err.message); }\n});",
    `client.on('messageCreate', async message => {
  try { await handlePixxieBotMessage(message); }
  catch (err) { console.error('[Hangry Games]', err.message); }
  try { await handleRumbleRoyaleMessage(message); }
  catch (err) { console.error('[Rumble Royale]', err.message); }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  try { await handlePixxieBotMessage(newMessage); }
  catch (err) { console.error('[Hangry Games Update]', err.message); }
  try { await handleRumbleRoyaleMessage(newMessage); }
  catch (err) { console.error('[Rumble Royale Update]', err.message); }
});`
  );
  fs.writeFileSync('src/index.js', c);
  console.log('messageUpdate listener added');
} else {
  console.log('already has messageUpdate');
}
