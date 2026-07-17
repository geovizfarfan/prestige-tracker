// src/games/rumbleRoyaleGameHandler.js
const db = require('../db/database');
const tracker = require('./rumbleRoyaleHandler');
const { EmbedBuilder } = require('discord.js');
const { LAVENDER, E, buildAutoResolveEmbed } = require('../utils/bountyEmbeds');
const { logUnifiedEvent, autoResolveBountiesForGame } = require('./unifiedGameTracker');

async function getResultsChannel(client, guildId) {
  const channelId = await db.getGuildConfig(guildId, 'hangry_results_channel');
  if (!channelId) return null;
  return client.channels.fetch(channelId).catch(() => null);
}

async function handleRumbleRoyaleMessage(message) {
  if (message.author.id !== tracker.RUMBLE_ROYALE_BOT_ID) return;

  const client = message.client;
  const channelId = message.channelId;
  const guildId = message.guildId;

  // Check registered channels
  const regChannels = await db.getGuildConfig(guildId, 'rumble_royale_channels').catch(() => null);
  if (!regChannels) return;
  const channels = JSON.parse(regChannels);
  if (!channels.includes(channelId)) return;

  const embedTexts = message.embeds.map(e =>
    [e.title, e.description, ...(e.fields?.map(f => f.value) || [])].filter(Boolean).join('\n')
  ).join('\n');
  const fullText = [message.content, embedTexts].filter(Boolean).join('\n');
  if (!fullText.trim()) return;

  // ── Game start ──────────────────────────────────────────────────────────────
  if (fullText.includes('Started a new Rumble Royale session') || fullText.includes('Number of participants:')) {
    const playerMatch = fullText.match(/Number of participants:\s*(\d+)/i);
    const totalPlayers = playerMatch ? parseInt(playerMatch[1]) : null;
    const activeData = await db.getGuildConfig(guildId, `rumble_royale_active_${channelId}`).catch(() => null);
    const sessionId = activeData ? JSON.parse(activeData).sessionId : null;
    tracker.startGame(channelId, totalPlayers, guildId, sessionId);
    await logUnifiedEvent({ guildId, channelId, gameType: 'rumbleroyale', eventType: 'game_start', totalPlayers }).catch(() => {});
    return;
  }

  const game = tracker.getGame(channelId);
  if (!game) return;

  // ── Players left ────────────────────────────────────────────────────────────
  const playersLeft = tracker.parsePlayersLeft(fullText);
  if (playersLeft !== null && game.totalPlayers) {
    game.deathCount = game.totalPlayers - playersLeft;
  }

  // ── Kill events (⚔️ lines) ──────────────────────────────────────────────────
  const lines = fullText.split('\n');
  for (const line of lines) {
    if (line.includes('⚔') || line.includes('✂')) {
      const boldCount = [...line.matchAll(/\*\*(.+?)\*\*/g)].length;
      if (boldCount >= 2) {
        const kill = tracker.parseKill(line);
        if (kill && kill.killer !== kill.victim) {
          const avenge = tracker.checkAvenge(game, kill.killer, kill.victim);
          game.kills.push({ ...kill, deathNumber: game.deathCount, timestamp: new Date() });
          if (avenge) game.avenges.push({ ...avenge, deathNumber: game.deathCount });
          await logUnifiedEvent({ guildId, channelId, gameType: 'rumbleroyale', eventType: 'kill', killer: kill.killer, victim: kill.victim, deathNumber: game.deathCount, avenge: avenge || null }).catch(() => {});
          await autoResolveBountiesForGame(client, game, { type: 'kill', ...kill, avenge }, guildId);
        }
      } else if (boldCount === 1) {
        // Suicide/environmental
        const suicide = tracker.parseSuicide(line);
        if (suicide) {
          game.suicideCount++;
          game.suicides.push({ ...suicide, deathNumber: game.deathCount, timestamp: new Date() });
          await logUnifiedEvent({ guildId, channelId, gameType: 'rumbleroyale', eventType: 'suicide', victim: suicide.victim, deathNumber: game.deathCount }).catch(() => {});
          await autoResolveBountiesForGame(client, game, { type: 'suicide', ...suicide }, guildId);
        }
      }
    }
    // Tombstone = suicide
    if (line.includes('🪦')) {
      const suicide = tracker.parseSuicide(line);
      if (suicide) {
        game.suicideCount++;
        game.suicides.push({ ...suicide, deathNumber: game.deathCount, timestamp: new Date() });
        await logUnifiedEvent({ guildId, channelId, gameType: 'rumbleroyale', eventType: 'suicide', victim: suicide.victim, deathNumber: game.deathCount }).catch(() => {});
        await autoResolveBountiesForGame(client, game, { type: 'suicide', ...suicide }, guildId);
      }
    }
  }

  // ── Winner ──────────────────────────────────────────────────────────────────
  if (fullText.includes('WINNER!') && message.embeds.length > 0) {
    const winnerEmbed = message.embeds.find(e => e.title?.includes('WINNER'));
    if (winnerEmbed) {
      const winner = tracker.parseWinner(winnerEmbed.description || '');
      if (winner) {
        game.winner = winner;
        await logUnifiedEvent({ guildId, channelId, gameType: 'rumbleroyale', eventType: 'winner', winner, totalDeaths: game.deathCount, kills: game.kills.length, suicides: game.suicides.length, avenges: game.avenges.length }).catch(() => {});
        await autoResolveBountiesForGame(client, game, { type: 'winner', winner }, guildId);

        // Post recap
        const resultsChannel = await getResultsChannel(client, guildId);
        if (resultsChannel) {
          const topKillerMap = game.kills.reduce((acc, k) => { acc[k.killer] = (acc[k.killer] || 0) + 1; return acc; }, {});
          const topKiller = Object.entries(topKillerMap).sort((a, b) => b[1] - a[1])[0];
          const recap = new EmbedBuilder()
            .setColor(LAVENDER)
            .setTitle(`${E.sparkle}  Rumble Royale — Game Over!`)
            .setDescription(
              `**Winner:** 🎉 **${winner}**\n` +
              `**Players:** ${game.totalPlayers || '?'}  ·  **Deaths:** ${game.deathCount}\n` +
              `**Kills:** ${game.kills.length}  ·  **Suicides:** ${game.suicides.length}  ·  **Avenges:** ${game.avenges.length}\n` +
              (topKiller ? `**Top Killer:** ${topKiller[0]} (${topKiller[1]} kills)` : '')
            )
            .setFooter({ text: 'Prestige Tracker • Rumble Royale' })
            .setTimestamp();
          await resultsChannel.send({ embeds: [recap] }).catch(() => {});
        }

        // Auto-add team points
        await awardTeamPoints(client, guildId, winner, null, 'rumbleroyale');
        tracker.endGame(channelId);
      }
    }
  }
}

async function awardTeamPoints(client, guildId, winnerUsername, winnerId, gameType) {
  const points = await db.getGuildConfig(guildId, `${gameType}_win_points`);
  if (!points || parseInt(points) === 0) return;

  const session = await db.getActiveSession();
  if (!session) return;

  // Find member by username or ID
  const members = await db.getMembersBySession(session.id);
  const member = winnerId
    ? members.find(m => m.user_id === winnerId)
    : members.find(m => m.username?.toLowerCase() === winnerUsername?.toLowerCase());

  if (!member) return;

  await db.updateMemberScore(session.id, member.user_id, parseInt(points));

  const notifChannelId = await db.getGuildConfig(guildId, 'game_points_channel');
  if (notifChannelId) {
    const ch = await client.channels.fetch(notifChannelId).catch(() => null);
    if (ch) {
      await ch.send({ embeds: [
        new EmbedBuilder()
          .setColor(LAVENDER)
          .setDescription(`${E.sparkle} **${winnerUsername}** won **Rumble Royale** and earned **+${points} pts** for **${member.team_name}**!`)
      ]}).catch(() => {});
    }
  }
}

module.exports = { handleRumbleRoyaleMessage, awardTeamPoints };
