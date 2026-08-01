// Tracks active Rumble Slaughter matches by channel.
const activeGames = new Map();

function getGame(channelId) {
  return activeGames.get(channelId) || null;
}

function startGame(channelId, totalPlayers, guildId, sessionId) {
  const game = {
    channelId,
    totalPlayers,
    guildId,
    sessionId: sessionId || null,
    deathCount: 0,
    suicideCount: 0,
    kills: [],
    suicides: [],
    avenges: [],
    winner: null,
    startedAt: new Date(),
    gameType: 'rumbleslaughter',
  };
  activeGames.set(channelId, game);
  return game;
}

function endGame(channelId) {
  const game = activeGames.get(channelId);
  activeGames.delete(channelId);
  return game;
}

function checkAvenge(game, newKiller, newVictim) {
  const priorKill = game.kills.find(
    kill => kill.killer.toLowerCase() === newVictim.toLowerCase()
  );
  if (!priorKill) return null;
  return {
    avenger: newKiller,
    avengee: newVictim,
    avenged: priorKill.victim,
  };
}

module.exports = { activeGames, getGame, startGame, endGame, checkAvenge };
