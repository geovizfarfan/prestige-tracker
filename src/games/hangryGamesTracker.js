const PIXXIEBOT_ID = '675996677366218774';
const activeGames = new Map(); // key: channelId

function getGame(channelId) { return activeGames.get(channelId) || null; }

function startGame(channelId, gameNumber, totalPlayers, guildId, sessionId, gameLink) {
  const game = {
    channelId, gameNumber, totalPlayers, guildId,
    sessionId: sessionId || null, gameLink: gameLink || null,
    deathCount: 0, suicideCount: 0,
    kills: [], suicides: [], voteElims: [], avenges: [],
    winner: null, startedAt: new Date(),
  };
  activeGames.set(channelId, game);
  return game;
}

function endGame(channelId) {
  const game = activeGames.get(channelId);
  activeGames.delete(channelId);
  return game;
}

function parseKill(text) {
  const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*/g)];
  if (boldMatches.length >= 2) {
    return { killer: boldMatches[0][1].trim(), victim: boldMatches[1][1].trim() };
  }
  return null;
}

function parseSuicide(text) {
  const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*/g)];
  if (boldMatches.length >= 1) return { victim: boldMatches[0][1].trim() };
  const arrowMatch = text.match(/[👉➡]\s*\*?(.+?)\*?\s+was/);
  if (arrowMatch) return { victim: arrowMatch[1].trim() };
  return null;
}

function parseRemaining(text) {
  const match = text.match(/(\d+)\s+picnic\s+goers?\s+remaining/i);
  return match ? parseInt(match[1]) : null;
}

function parseVoteElim(text) {
  if (!text.includes('Voting Results:')) return null;
  const lines = text.split('\n');
  const resultsIdx = lines.findIndex(l => l.includes('Voting Results:'));
  if (resultsIdx === -1) return null;
  const votingLines = lines.slice(resultsIdx + 1).filter(l => l.trim() && l.match(/\d+%/));
  const candidates = votingLines.map(line => {
    const pctMatch = line.match(/(\d+)%/);
    const boldMatch = line.match(/\*\*(.+?)\*\*/);
    const plainMatch = line.match(/[🙌]\s*(.+?)\s+\d+%/);
    const name = boldMatch ? boldMatch[1].trim() : (plainMatch ? plainMatch[1].trim() : null);
    return { name, pct: pctMatch ? parseInt(pctMatch[1]) : 0 };
  }).filter(c => c.name);
  if (!candidates.length) return null;
  const maxPct = Math.max(...candidates.map(c => c.pct));
  if (maxPct === 0) return null;
  const eliminated = candidates.find(c => c.pct === maxPct);
  return eliminated ? { victim: eliminated.name } : null;
}

function parseGameStart(text) {
  const gameNumMatch = text.match(/(\d+)(?:st|nd|rd|th)\s+Hangry\s+Games/i);
  const tributeMatch = text.match(/(\d+)\s+tributes?/i);
  return {
    gameNumber: gameNumMatch ? parseInt(gameNumMatch[1]) : null,
    totalPlayers: tributeMatch ? parseInt(tributeMatch[1]) : null,
  };
}

function parseWinner(text) {
  const match = text.match(/\*\*(.+?)\*\*\s+won\s+THE\s+BOARD\s+PRINCESS/i);
  if (match) return match[1].trim();
  const italicMatch = text.match(/[🎉🎊]\s+\*(.+?)\*\s+won/i);
  return italicMatch ? italicMatch[1].trim() : null;
}

function checkAvenge(game, newKiller, newVictim) {
  const priorKill = game.kills.find(k => k.killer.toLowerCase() === newVictim.toLowerCase());
  if (priorKill) {
    return { avenger: newKiller, avengee: newVictim, avenged: priorKill.victim };
  }
  return null;
}

module.exports = {
  PIXXIEBOT_ID, activeGames,
  getGame, startGame, endGame,
  parseKill, parseSuicide, parseRemaining, parseVoteElim,
  parseGameStart, parseWinner, checkAvenge,
};
