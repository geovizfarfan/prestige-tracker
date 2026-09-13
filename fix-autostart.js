const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Replace the "if (!game) return;" with auto-start logic
c = c.replace(
  `  const game = tracker.getGame(channelId);
  if (!game) return;`,
  `  let game = tracker.getGame(channelId);
  if (!game) {
    // Auto-start game if hangry-start was run but game start message was missed
    const activeData = await db.getGuildConfig(guildId, \`hangry_active_\${channelId}\`).catch(() => null);
    if (!activeData) return;
    const parsed = JSON.parse(activeData);
    const { gameNumber, totalPlayers } = tracker.parseGameStart(fullText);
    game = tracker.startGame(channelId, gameNumber, totalPlayers, guildId, parsed.sessionId, parsed.gameLink);
    await db.logHangryGame({ channelId, gameNumber, totalPlayers, guildId }).catch(() => {});
    console.log('[Hangry] Auto-started game from active session:', parsed.sessionId);
  }`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
