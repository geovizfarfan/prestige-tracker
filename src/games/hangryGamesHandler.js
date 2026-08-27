const db = require('../db/database');
const tracker = require('./hangryGamesTracker');
const { EmbedBuilder } = require('discord.js');
const { LAVENDER, E, buildAutoResolveEmbed, buildPayoutTrackerEmbed } = require('../utils/bountyEmbeds');

async function getResultsChannel(client, guildId) {
  const channelId = await db.getGuildConfig(guildId, 'hangry_results_channel');
  if (!channelId) return null;
  return client.channels.fetch(channelId).catch(() => null);
}

async function postResult(client, guildId, embed) {
  const ch = await getResultsChannel(client, guildId);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function autoResolveBounties(client, game, event) {
  if (!game.sessionId) return;

  const bounties = await db.getBounties(game.sessionId).catch(() => []);
  const resolvedBounties = [];

  for (const b of bounties) {
    let winnerUsername = null, winnerId = null, resolved = false, isNA = false;

    // Kill bounty
    if (b.type === 'kill' && event.type === 'kill' && b.target_username) {
      if (event.victim?.toLowerCase() === b.target_username.toLowerCase()) {
        // Check if victim was a suicide — if so N/A
        const wasSuicide = game.suicides.some(s => s.victim?.toLowerCase() === event.victim?.toLowerCase());
        if (wasSuicide) { isNA = true; resolved = true; }
        else { winnerUsername = event.killer; resolved = true; }
      }
    }

    // Avenge bounty — target was killed, now their killer got killed
    if (b.type === 'avenge' && b.target_username && event.type === 'kill' && event.avenge) {
      if (event.avenge.avenged?.toLowerCase() === b.target_username.toLowerCase()) {
        // Check if original death was suicide
        const wasSuicide = game.suicides.some(s => s.victim?.toLowerCase() === b.target_username.toLowerCase());
        if (wasSuicide) { isNA = true; resolved = true; }
        // Check if avenger died by suicide
        else if (event.avenge.avengee && game.suicides.some(s => s.victim?.toLowerCase() === event.avenge.avengee?.toLowerCase())) {
          isNA = true; resolved = true;
        }
        else { winnerUsername = event.avenge.avenger; resolved = true; }
      }
    }

    // Death #N bounty (kills + suicides)
    if (b.type === 'death' && b.death_number === game.deathCount) {
      if (event.type === 'kill') winnerUsername = event.killer;
      else isNA = true;
      resolved = true;
    }

    // Suicide #N bounty (suicides only)
    if (b.type === 'suicide' && event.type === 'suicide' && b.death_number === game.suicideCount) {
      isNA = true; // Suicide bounty — no winner, N/A
      resolved = true;
    }

    // Winner bounty
    if (b.type === 'winner' && event.type === 'winner') {
      winnerUsername = event.winner; resolved = true;
    }

    if (resolved) {
      const status = isNA ? 'na' : 'claimed';
      await db.resolveBounty(b.id, isNA ? null : winnerId, isNA ? 'N/A' : winnerUsername, status).catch(() => {});

      const session = await db.getBountySessionById(game.sessionId).catch(() => null);
      if (session) {
        const embed = buildAutoResolveEmbed(b, session, isNA ? null : winnerUsername, winnerId, game.deathCount, game.gameNumber);
        await postResult(client, game.guildId, embed);
        resolvedBounties.push(b);
      }
    }
  }

  return resolvedBounties;
}

async function postPayoutTracker(client, game, session) {
  const guildId = game.guildId;
  const resultsChannel = await getResultsChannel(client, guildId);
  if (!resultsChannel) return;

  const allBounties = await db.getAllSessionBounties(game.sessionId).catch(() => []);
  const resolved = allBounties.filter(b => ['claimed', 'paid', 'na'].includes(b.status));
  if (!resolved.length) return;

  const embed = buildPayoutTrackerEmbed(session, allBounties, game.gameNumber);
  const msg = await resultsChannel.send({ embeds: [embed] }).catch(() => null);

  if (msg) {
    await db.setGuildConfig(guildId, `payout_msg_${game.sessionId}`, JSON.stringify({
      channelId: resultsChannel.id, messageId: msg.id,
    })).catch(() => {});
    if (game.gameNumber) {
      await db.setGuildConfig(guildId, `session_game_number_${game.sessionId}`, String(game.gameNumber)).catch(() => {});
    }
  }
}

async function handlePixxieBotMessage(message) {
// Bot ID check removed - filtering by content patterns only

  const client = message.client;
  const channelId = message.channelId;
  const guildId = message.guildId;

  // Check if this channel is registered
  const hangryChannels = await db.getGuildConfig(guildId, 'hangry_channels').catch(() => null);
  if (!hangryChannels) return;
  const channels = JSON.parse(hangryChannels);
  console.log("[Hangry] registered:", channels, "this:", channelId);
  if (!channels.includes(channelId)) return;

  const embedTexts = message.embeds.map(e =>
    [e.title, e.description, ...(e.fields?.map(f => f.value) || [])].filter(Boolean).join('\n')
  ).join('\n');
  const fullText = [message.content, embedTexts].filter(Boolean).join('\n');
  console.log("[Hangry] GOT MSG from", message.author.username, "full:", fullText.slice(0,150));
  if (!fullText.trim()) { 
    if (message.embeds.length) {
      const e = message.embeds[0];
      console.log("[Hangry] RAW EMBED keys:", Object.keys(e.data || e));
      console.log("[Hangry] RAW EMBED data:", JSON.stringify(e.data || e).slice(0,500));
    }
    return; 
  }

  // ── Game start ──────────────────────────────────────────────────────────
  if ((fullText.includes("has started THE BOARD PRINCESS's") || fullText.includes('The Battle Begins')) && fullText.includes('tributes')) {
    const { gameNumber, totalPlayers } = tracker.parseGameStart(fullText);

    // Check if admin manually started tracking via /hangry-start
    const activeData = await db.getGuildConfig(guildId, `hangry_active_${channelId}`).catch(() => null);
    let sessionId = null, gameLink = null;
    if (activeData) {
      const parsed = JSON.parse(activeData);
      sessionId = parsed.sessionId;
      gameLink = parsed.gameLink;
    }

    tracker.startGame(channelId, gameNumber, totalPlayers, guildId, sessionId, gameLink);
    await db.logHangryGame({ channelId, gameNumber, totalPlayers, guildId }).catch(() => {});
    return;
  }

  const game = tracker.getGame(channelId);
  if (!game) return;

  // ── Remaining count ─────────────────────────────────────────────────────
  const remaining = tracker.parseRemaining(fullText);
  if (remaining !== null && game.totalPlayers) {
    game.deathCount = game.totalPlayers - remaining;
  }

  // ── Kill event ──────────────────────────────────────────────────────────
  const hasSword = fullText.includes('⚔') || fullText.includes('✂️') || fullText.includes('crossedswords') || fullText.includes(':knife:') || /^[⚔✂]/.test(fullText.trim());
  if (hasSword && !fullText.includes('A half-eaten sandwich')) {
    const lines = fullText.split('\n');
    for (const line of lines) {
      if (line.includes('⚔') || line.includes('✂')) {
        const kill = tracker.parseKill(line);
        if (kill && kill.killer !== kill.victim) {
          const avenge = tracker.checkAvenge(game, kill.killer, kill.victim);
          game.kills.push({ ...kill, deathNumber: game.deathCount, timestamp: new Date() });
          if (avenge) game.avenges.push({ ...avenge, deathNumber: game.deathCount });
          await db.logHangryEvent({ channelId, gameNumber: game.gameNumber, type: 'kill', killer: kill.killer, victim: kill.victim, deathNumber: game.deathCount, avenge: avenge || null }).catch(() => {});
          await autoResolveBounties(client, game, { type: 'kill', ...kill, avenge });
        }
      }
    }
    return;
  }

  // ── Suicide/environmental ───────────────────────────────────────────────
  if (fullText.includes('A half-eaten sandwich was found!')) {
    const suicide = tracker.parseSuicide(fullText);
    if (suicide) {
      game.suicideCount++;
      game.suicides.push({ ...suicide, deathNumber: game.deathCount, suicideNumber: game.suicideCount, timestamp: new Date() });
      await db.logHangryEvent({ channelId, gameNumber: game.gameNumber, type: 'suicide', victim: suicide.victim, deathNumber: game.deathCount }).catch(() => {});
      await autoResolveBounties(client, game, { type: 'suicide', ...suicide });
    }
    return;
  }

  // ── Vote elimination ────────────────────────────────────────────────────
  if (fullText.includes('Too many crumbs, not enough sandwiches')) {
    const elim = tracker.parseVoteElim(fullText);
    if (elim) {
      game.deathCount++;
      game.voteElims.push({ ...elim, deathNumber: game.deathCount, timestamp: new Date() });
      await db.logHangryEvent({ channelId, gameNumber: game.gameNumber, type: 'vote', victim: elim.victim, deathNumber: game.deathCount }).catch(() => {});
      await autoResolveBounties(client, game, { type: 'vote', ...elim });
    }
    return;
  }

  // ── Game winner ─────────────────────────────────────────────────────────
  if (fullText.includes('won THE BOARD PRINCESS') && fullText.includes('Hangry Games')) {
    const winner = tracker.parseWinner(fullText);
    if (winner) {
      game.winner = winner;
      await db.logHangryWinner({ channelId, gameNumber: game.gameNumber, winner, totalDeaths: game.deathCount, kills: game.kills, suicides: game.suicides, avenges: game.avenges }).catch(() => {});
      await autoResolveBounties(client, game, { type: 'winner', winner });

      // Post game recap
      const topKillerMap = game.kills.reduce((acc, k) => { acc[k.killer] = (acc[k.killer] || 0) + 1; return acc; }, {});
      const topKiller = Object.entries(topKillerMap).sort((a, b) => b[1] - a[1])[0];

      const resultsChannel = await getResultsChannel(client, guildId);
      if (resultsChannel) {
        const recap = new EmbedBuilder()
          .setColor(LAVENDER)
          .setTitle(`${E.sparkle}  Hangry Games #${game.gameNumber || '?'} — Game Over!`)
          .setDescription(
            `**Winner:** 🎉 **${winner}**\n` +
            `**Total Players:** ${game.totalPlayers || '?'}\n` +
            `**Total Deaths:** ${game.deathCount}\n` +
            `**Kills:** ${game.kills.length}  ·  **Suicides:** ${game.suicides.length}  ·  **Vote Elims:** ${game.voteElims.length}  ·  **Avenges:** ${game.avenges.length}\n` +
            (topKiller ? `**Top Killer:** ${topKiller[0]} (${topKiller[1]} kills)` : '')
          )
          .setFooter({ text: 'Prestige Tracker • Hangry Games' })
          .setTimestamp();
        await resultsChannel.send({ embeds: [recap] }).catch(() => {});
      }

      // Post payout tracker if there's a linked session
      if (game.sessionId) {
        const session = await db.getBountySessionById(game.sessionId).catch(() => null);
        if (session) await postPayoutTracker(client, game, session);
      }

      tracker.endGame(channelId);
      await db.setGuildConfig(guildId, `hangry_active_${channelId}`, null).catch(() => {});
    }
  }
}

module.exports = { handlePixxieBotMessage };
