const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Add broader debug - log ALL messages in registered channels regardless of author
c = c.replace(
  'async function handlePixxieBotMessage(message) {\n  if (message.author.id !== tracker.PIXXIEBOT_ID) return;',
  `async function handlePixxieBotMessage(message) {
  // Log ALL messages in registered hangry channels for debugging
  const dbg_guildId = message.guildId;
  const dbg_channels = await db.getGuildConfig(dbg_guildId, 'hangry_channels').catch(() => null);
  if (dbg_channels) {
    const dbg_list = JSON.parse(dbg_channels);
    if (dbg_list.includes(message.channelId)) {
      console.log('[Hangry Channel] Author:', message.author.id, message.author.username, '| Embeds:', message.embeds.length, '| Content:', message.content?.slice(0,50) || '(none)');
    }
  }
  if (message.author.id !== tracker.PIXXIEBOT_ID) return;`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
