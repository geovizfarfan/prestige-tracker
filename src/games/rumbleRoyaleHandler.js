// src/games/rumbleRoyaleHandler.js
// Tracks live Rumble Royale sessions from the Rumble Royale bot

const RUMBLE_ROYALE_BOT_ID = '693167035068317736';
const activeGames = new Map();

function getGame(channelId) { return activeGames.get(channelId) || null; }

function startGame(channelId, totalPlayers, guildId, sessionId) {
  const game = {
    channelId, totalPlayers, guildId, sessionId: sessionId || null,
    deathCount: 0, suicideCount: 0,
    kills: [], suicides: [], avenges: [],
    winner: null, startedAt: new Date(),
    gameType: 'rumbleroyale',
  };
  activeGames.set(channelId, game);
  return game;
}

function endGame(channelId) {
  const game = activeGames.get(channelId);
  activeGames.delete(channelId);
  return game;
}

// Kill: ⚔️ | **killer** [verb] **victim**
function parseKill(text) {
  const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*/g)];
  if (boldMatches.length >= 2) {
    return { killer: boldMatches[0][1].trim(), victim: boldMatches[1][1].trim() };
  }
  return null;
}

// Suicide: 🪦 | **player** [environmental]
function parseSuicide(text) {
  const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*/g)];
  if (boldMatches.length === 1) return { victim: boldMatches[0][1].trim() };
  // Also check strikethrough (dead player format)
  const strikeMatch = text.match(/~~(.+?)~~/);
  if (strikeMatch) return { victim: strikeMatch[1].trim() };
  return null;
}

function parsePlayersLeft(text) {
  const match = text.match(/Players?\s+Left:\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function parseWinner(text) {
  // Winner embed: title "WINNER!" description starts with plain username
  const match = text.match(/^(.+?)\nReward:/s);
  if (match) return match[1].trim();
  return null;
}

function checkAvenge(game, newKiller, newVictim) {
  const priorKill = game.kills.find(k => k.killer.toLowerCase() === newVictim.toLowerCase());
  if (priorKill) return { avenger: newKiller, avengee: newVictim, avenged: priorKill.victim };
  return null;
}

module.exports = {
  RUMBLE_ROYALE_BOT_ID, activeGames,
  getGame, startGame, endGame,
  parseKill, parseSuicide, parsePlayersLeft, parseWinner, checkAvenge,
};
