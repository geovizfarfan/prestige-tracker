const db = require('../db/database');
const tracker = require('./rumbleSlaughterTracker');
const { logUnifiedEvent, autoResolveBountiesForGame } = require('./unifiedGameTracker');

function messageText(message) {
  const embeds = message.embeds.map(embed =>
    [
      embed.title,
      embed.description,
      ...(embed.fields?.flatMap(field => [field.name, field.value]) || []),
    ].filter(Boolean).join('\n')
  );
  return [message.content, ...embeds].filter(Boolean).join('\n');
}

function boldNames(line) {
  return [...line.matchAll(/\*\*(.+?)\*\*/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
}

async function configured(message) {
  if (!message.guildId || !message.author.bot) return false;
  const stored = await db.getGuildConfig(
    message.guildId,
    'rumble_slaughter_channels'
  ).catch(() => null);
  if (!stored) return false;

  try {
    const channels = JSON.parse(stored);
    return Array.isArray(channels) && channels.includes(message.channelId);
  } catch {
    return false;
  }
}

async function latestSessionForChannel(guildId, channelId) {
  const sessions = await db.getActiveBountySessions(guildId).catch(() => []);
  return sessions.find(session => session.game_channel_id === channelId) || null;
}

async function handleRumbleSlaughterMessage(message) {
  if (!await configured(message)) return;

  const text = messageText(message);
  if (!text.trim()) return;

  if (text.includes('THE ARENA IS SEALED')) {
    const players = text.match(/(\d+)\s+competitors?\s+have entered/i);
    const session = await latestSessionForChannel(message.guildId, message.channelId);
    const game = tracker.startGame(
      message.channelId,
      players ? parseInt(players[1]) : null,
      message.guildId,
      session?.id || null
    );

    await logUnifiedEvent({
      guildId: message.guildId,
      channelId: message.channelId,
      gameType: game.gameType,
      eventType: 'game_start',
      totalPlayers: game.totalPlayers,
    }).catch(error => console.error('[Rumble Slaughter Start]', error));
    return;
  }

  const game = tracker.getGame(message.channelId);
  if (!game) return;

  const championEmbed = message.embeds.find(embed =>
    embed.title?.toUpperCase().includes('RUMBLE SLAUGHTER') &&
    embed.title?.toUpperCase().includes('CHAMPION')
  );

  if (championEmbed) {
    const description = championEmbed.description || '';
    const names = boldNames(description);
    const winner =
      names[0] ||
      description.match(/^([^\n]+?)\s+is champion/i)?.[1]?.trim() ||
      message.mentions.users.first()?.username;

    if (winner) {
      game.winner = winner;
      await logUnifiedEvent({
        guildId: message.guildId,
        channelId: message.channelId,
        gameType: game.gameType,
        eventType: 'winner',
        winner,
        winnerId: message.mentions.users.first()?.id || null,
        totalPlayers: game.totalPlayers,
        totalDeaths: game.deathCount,
        kills: game.kills.length,
        suicides: game.suicides.length,
        avenges: game.avenges.length,
      }).catch(error => console.error('[Rumble Slaughter Winner]', error));

      await autoResolveBountiesForGame(
        message.client,
        game,
        { type: 'winner', winner },
        message.guildId
      ).catch(error => console.error('[Rumble Slaughter Bounty]', error));
    }

    tracker.endGame(message.channelId);
    return;
  }

  const roundEmbed = message.embeds.find(embed => /Round\s+\d+/i.test(embed.title || ''));
  if (!roundEmbed) return;

  const roundText = [
    roundEmbed.description,
    ...(roundEmbed.fields?.flatMap(field => [field.name, field.value]) || []),
  ].filter(Boolean).join('\n');

  const aliveMatch = roundText.match(/Still Alive\s*\((\d+)\)/i);
  if (aliveMatch && game.totalPlayers) {
    game.deathCount = Math.max(game.deathCount, game.totalPlayers - parseInt(aliveMatch[1]));
  }

  for (const line of roundText.split('\n')) {
    if (/Still Alive/i.test(line)) continue;
    const names = boldNames(line);

    if (names.length >= 2) {
      const [killer, victim] = names;
      if (killer.toLowerCase() === victim.toLowerCase()) continue;
      const duplicate = game.kills.some(
        kill => kill.killer === killer && kill.victim === victim
      );
      if (duplicate) continue;

      const avenge = tracker.checkAvenge(game, killer, victim);
      game.kills.push({ killer, victim, avenge });
      if (avenge) game.avenges.push(avenge);

      await logUnifiedEvent({
        guildId: message.guildId,
        channelId: message.channelId,
        gameType: game.gameType,
        eventType: 'kill',
        killer,
        victim,
        deathNumber: game.deathCount,
        avenge,
      }).catch(error => console.error('[Rumble Slaughter Kill]', error));

      await autoResolveBountiesForGame(
        message.client,
        game,
        { type: 'kill', killer, victim, avenge },
        message.guildId
      ).catch(error => console.error('[Rumble Slaughter Bounty]', error));
    } else if (names.length === 1 && !/reviv|Still Alive/i.test(line)) {
      const victim = names[0];
      if (game.suicides.some(item => item.victim === victim)) continue;
      game.suicideCount += 1;
      game.suicides.push({ victim });

      await logUnifiedEvent({
        guildId: message.guildId,
        channelId: message.channelId,
        gameType: game.gameType,
        eventType: 'suicide',
        victim,
        deathNumber: game.deathCount,
      }).catch(error => console.error('[Rumble Slaughter Elimination]', error));

      await autoResolveBountiesForGame(
        message.client,
        game,
        { type: 'suicide', victim },
        message.guildId
      ).catch(error => console.error('[Rumble Slaughter Bounty]', error));
    }
  }
}

module.exports = { handleRumbleSlaughterMessage };
