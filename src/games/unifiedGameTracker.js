// src/games/unifiedGameTracker.js
// Unified database logging and bounty resolution for ALL tracked games

const db = require('../db/database');
const { buildAutoResolveEmbed } = require('../utils/bountyEmbeds');

async function ensureUnifiedTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS unified_game_events (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      event_type TEXT NOT NULL,
      killer TEXT,
      victim TEXT,
      winner TEXT,
      avenger TEXT,
      avenged TEXT,
      death_number INTEGER,
      total_players INTEGER,
      total_deaths INTEGER,
      total_kills INTEGER,
      total_suicides INTEGER,
      total_avenges INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS unified_game_wins (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      channel_id TEXT,
      winner_username TEXT,
      winner_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function logUnifiedEvent(data) {
  await ensureUnifiedTables();
  await db.query(`
    INSERT INTO unified_game_events (guild_id, channel_id, game_type, event_type, killer, victim, winner, avenger, avenged, death_number, total_players, total_deaths, total_kills, total_suicides, total_avenges)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [
    data.guildId, data.channelId, data.gameType, data.eventType,
    data.killer || null, data.victim || null, data.winner || null,
    data.avenge?.avenger || null, data.avenge?.avenged || null,
    data.deathNumber || null, data.totalPlayers || null,
    data.totalDeaths || null, data.kills || null,
    data.suicides || null, data.avenges || null,
  ]);

  // Log winner separately for easy querying
  if (data.eventType === 'winner' && data.winner) {
    await db.query(`
      INSERT INTO unified_game_wins (guild_id, game_type, channel_id, winner_username, winner_id)
      VALUES ($1,$2,$3,$4,$5)
    `, [data.guildId, data.gameType, data.channelId, data.winner, data.winnerId || null]);
  }
}

async function getUnifiedStats(guildId, gameType, limit = 15) {
  await ensureUnifiedTables();

  const wins = await db.query(`
    SELECT winner_username, winner_id, COUNT(*) as wins
    FROM unified_game_wins
    WHERE guild_id = $1 ${gameType !== 'all' ? 'AND game_type = $2' : ''}
    GROUP BY winner_username, winner_id
    ORDER BY wins DESC LIMIT ${gameType !== 'all' ? '$3' : '$2'}
  `, gameType !== 'all' ? [guildId, gameType, limit] : [guildId, limit]);

  const kills = await db.query(`
    SELECT killer, COUNT(*) as kills
    FROM unified_game_events
    WHERE guild_id = $1 AND event_type = 'kill' AND killer IS NOT NULL
    ${gameType !== 'all' ? 'AND game_type = $2' : ''}
    GROUP BY killer ORDER BY kills DESC LIMIT ${gameType !== 'all' ? '$3' : '$2'}
  `, gameType !== 'all' ? [guildId, gameType, limit] : [guildId, limit]);

  const suicides = await db.query(`
    SELECT victim, COUNT(*) as suicides
    FROM unified_game_events
    WHERE guild_id = $1 AND event_type = 'suicide' AND victim IS NOT NULL
    ${gameType !== 'all' ? 'AND game_type = $2' : ''}
    GROUP BY victim ORDER BY suicides DESC LIMIT ${gameType !== 'all' ? '$3' : '$2'}
  `, gameType !== 'all' ? [guildId, gameType, limit] : [guildId, limit]);

  return { wins: wins.rows, kills: kills.rows, suicides: suicides.rows };
}

async function getUnifiedPlayerStats(userId, username, guildId) {
  await ensureUnifiedTables();
  const games = ['hangrygames', 'rumbleroyale', 'rumbleslaughter', 'regretgames'];

  const stats = {};
  for (const g of games) {
    const wins = await db.query(`
      SELECT COUNT(*) as count FROM unified_game_wins
      WHERE guild_id = $1 AND game_type = $2 AND (winner_id = $3 OR LOWER(winner_username) = LOWER($4))
    `, [guildId, g, userId, username]);

    const kills = await db.query(`
      SELECT COUNT(*) as count FROM unified_game_events
      WHERE guild_id = $1 AND game_type = $2 AND event_type = 'kill' AND LOWER(killer) = LOWER($3)
    `, [guildId, g, username]);

    const deaths = await db.query(`
      SELECT COUNT(*) as count FROM unified_game_events
      WHERE guild_id = $1 AND game_type = $2 AND event_type IN ('kill','suicide','vote') AND LOWER(victim) = LOWER($3)
    `, [guildId, g, username]);

    stats[g] = {
      wins: parseInt(wins.rows[0]?.count || 0),
      kills: parseInt(kills.rows[0]?.count || 0),
      deaths: parseInt(deaths.rows[0]?.count || 0),
    };
  }

  // Total wins across all games
  const totalWins = await db.query(`
    SELECT COUNT(*) as count FROM unified_game_wins
    WHERE guild_id = $1 AND (winner_id = $2 OR LOWER(winner_username) = LOWER($3))
  `, [guildId, userId, username]);

  stats.totalWins = parseInt(totalWins.rows[0]?.count || 0);
  return stats;
}

async function autoResolveBountiesForGame(client, game, event, guildId) {
  if (!game.sessionId) return;

  const bounties = await db.getBounties(game.sessionId).catch(() => []);
  const resultsChannelId = await db.getGuildConfig(guildId, 'bounty_results_channel');

  for (const b of bounties) {
    let winnerUsername = null, winnerId = null, resolved = false, isNA = false;

    if (event.type === 'winner' && b.type === 'winner') {
      winnerUsername = event.winner; resolved = true;
    }

    if (event.type === 'kill' && b.type === 'kill' && b.target_username) {
      if (event.victim?.toLowerCase() === b.target_username.toLowerCase()) {
        winnerUsername = event.killer; resolved = true;
      }
    }

    if (event.type === 'kill' && b.type === 'avenge' && b.target_username && event.avenge) {
      if (event.avenge.avenged?.toLowerCase() === b.target_username.toLowerCase()) {
        const wasSuicide = game.suicides?.some(s => s.victim?.toLowerCase() === b.target_username.toLowerCase());
        if (wasSuicide) { isNA = true; resolved = true; }
        else { winnerUsername = event.avenge.avenger; resolved = true; }
      }
    }

    if (event.type === 'suicide' && b.type === 'kill' && b.target_username) {
      if (event.victim?.toLowerCase() === b.target_username.toLowerCase()) {
        isNA = true; resolved = true;
      }
    }

    if (event.type === 'kill' && b.type === 'death' && b.death_number === game.deathCount) {
      winnerUsername = event.killer; resolved = true;
    }

    if (event.type === 'suicide' && b.type === 'suicide' && b.death_number === game.suicideCount) {
      isNA = true; resolved = true;
    }

    if (event.type === 'kill' && b.type === 'death' && b.death_number === game.deathCount) {
      winnerUsername = event.killer; resolved = true;
    }

    if (resolved) {
      const status = isNA ? 'na' : 'claimed';
      await db.resolveBounty(b.id, isNA ? null : winnerId, isNA ? 'N/A' : winnerUsername, status).catch(() => {});

      if (resultsChannelId) {
        const ch = await client.channels.fetch(resultsChannelId).catch(() => null);
        if (ch) {
          const session = await db.getBountySessionById(game.sessionId).catch(() => null);
          if (session) {
            const embed = buildAutoResolveEmbed(b, session, isNA ? null : winnerUsername, winnerId, game.deathCount, null);
            await ch.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    }
  }
}

module.exports = { logUnifiedEvent, getUnifiedStats, getUnifiedPlayerStats, autoResolveBountiesForGame, ensureUnifiedTables };
