const fs = require('fs');
let c = fs.readFileSync('src/db/database.js', 'utf8');

const newFunctions = `

// ─── Per-guild config ───────────────────────────────────────────────────────

async function ensureGuildConfigTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (guild_id, key)
    )
  \`);
}

async function setGuildConfig(guildId, key, value) {
  await ensureGuildConfigTable();
  if (value === null) {
    await query(\`DELETE FROM guild_config WHERE guild_id = $1 AND key = $2\`, [guildId, key]);
    return;
  }
  await query(\`INSERT INTO guild_config (guild_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (guild_id, key) DO UPDATE SET value = $3\`, [guildId, key, value]);
}

async function getGuildConfig(guildId, key) {
  await ensureGuildConfigTable();
  const res = await query('SELECT value FROM guild_config WHERE guild_id = $1 AND key = $2', [guildId, key]);
  return res.rows[0]?.value || null;
}

// ─── Bounty sessions (per-guild) ────────────────────────────────────────────

async function ensureBountySessionTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounty_sessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      game_channel_id TEXT NOT NULL,
      bounty_channel_id TEXT,
      game_link TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by_id TEXT NOT NULL,
      created_by_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  \`);
  await query(\`ALTER TABLE bounty_sessions ADD COLUMN IF NOT EXISTS guild_id TEXT\`);
  await query(\`ALTER TABLE bounty_sessions ADD COLUMN IF NOT EXISTS game_link TEXT\`);
}

async function createBountySession(data) {
  await ensureBountySessionTable();
  const res = await query(\`
    INSERT INTO bounty_sessions (guild_id, name, game_channel_id, bounty_channel_id, game_link, created_by_id, created_by_username)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  \`, [data.guild_id, data.name, data.game_channel_id, data.bounty_channel_id || null, data.game_link || null, data.created_by_id, data.created_by_username]);
  return res.rows[0];
}

async function getActiveBountySessions(guildId) {
  await ensureBountySessionTable();
  const res = await query(\`SELECT * FROM bounty_sessions WHERE status = 'active' AND (guild_id = $1 OR guild_id IS NULL) ORDER BY id DESC\`, [guildId]);
  return res.rows;
}

async function getAllBountySessions(guildId) {
  await ensureBountySessionTable();
  const res = await query(\`SELECT * FROM bounty_sessions WHERE guild_id = $1 OR guild_id IS NULL ORDER BY id DESC LIMIT 50\`, [guildId]);
  return res.rows;
}

async function getBountySessionById(id) {
  await ensureBountySessionTable();
  const res = await query('SELECT * FROM bounty_sessions WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function endBountySession(id) {
  await query(\`UPDATE bounty_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1\`, [id]);
}

// ─── Bounties (per-guild) ────────────────────────────────────────────────────

async function ensureBountyTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounties (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      session_id INTEGER,
      channel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      prize TEXT NOT NULL,
      payee_id TEXT,
      payee_username TEXT NOT NULL,
      target_id TEXT,
      target_username TEXT,
      death_number INTEGER,
      set_by_id TEXT NOT NULL,
      set_by_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      winner_id TEXT,
      winner_username TEXT,
      game_link TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ
    )
  \`);
  for (const col of ['guild_id TEXT', 'payee_id TEXT', 'target_id TEXT', 'paid_at TIMESTAMPTZ', 'game_link TEXT']) {
    const [colName] = col.split(' ');
    await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS \${colName} \${col.split(' ').slice(1).join(' ')}\`).catch(() => {});
  }
}

async function addBounty(data) {
  await ensureBountyTable();
  const res = await query(\`
    INSERT INTO bounties (guild_id, session_id, channel_id, type, prize, payee_id, payee_username, target_id, target_username, death_number, set_by_id, set_by_username, game_link, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') RETURNING *
  \`, [data.guild_id || null, data.session_id || null, data.channel_id, data.type, data.prize,
    data.payee_id || null, data.payee_username, data.target_id || null, data.target_username || null,
    data.death_number || null, data.set_by_id, data.set_by_username, data.game_link || null]);
  return res.rows[0];
}

async function getBounties(sessionId) {
  await ensureBountyTable();
  const res = await query(\`SELECT * FROM bounties WHERE session_id = $1 AND status = 'active' ORDER BY id ASC\`, [sessionId]);
  return res.rows;
}

async function getAllSessionBounties(sessionId) {
  await ensureBountyTable();
  const res = await query(\`SELECT * FROM bounties WHERE session_id = $1 ORDER BY id ASC\`, [sessionId]);
  return res.rows;
}

async function getActiveBountiesForGuild(guildId) {
  await ensureBountyTable();
  const res = await query(\`SELECT * FROM bounties WHERE guild_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 100\`, [guildId]);
  return res.rows;
}

async function getPendingPayoutBounties(guildId) {
  await ensureBountyTable();
  const res = await query(\`SELECT * FROM bounties WHERE guild_id = $1 AND status = 'claimed' ORDER BY id DESC\`, [guildId]);
  return res.rows;
}

async function getBountyById(id) {
  await ensureBountyTable();
  const res = await query('SELECT * FROM bounties WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function approveBounty(id, reviewerId, reviewerUsername) {
  await query(\`UPDATE bounties SET status = 'active' WHERE id = $1\`, [id]);
  return getBountyById(id);
}

async function rejectBounty(id, reviewerId, reviewerUsername, reason) {
  await query(\`UPDATE bounties SET status = 'rejected' WHERE id = $1\`, [id]);
  return getBountyById(id);
}

async function resolveBounty(id, winnerId, winnerUsername, status) {
  await query(\`UPDATE bounties SET status = $1, winner_id = $2, winner_username = $3, resolved_at = NOW() WHERE id = $4\`,
    [status || 'claimed', winnerId || null, winnerUsername || null, id]);
}

async function markBountyPaid(id) {
  await query(\`UPDATE bounties SET status = 'paid', paid_at = NOW() WHERE id = $1\`, [id]);
  return getBountyById(id);
}

async function removeBounty(id) {
  const res = await query('DELETE FROM bounties WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] || null;
}

async function editBounty(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getBountyById(id);
  const setClause = keys.map((k, i) => \`\${k} = $\${i + 1}\`).join(', ');
  await query(\`UPDATE bounties SET \${setClause} WHERE id = $\${keys.length + 1}\`, [...Object.values(fields), id]);
  return getBountyById(id);
}

async function getBountyStats(guildId, limit = 10) {
  await ensureBountyTable();
  const res = await query(\`SELECT winner_username, COUNT(*) as wins FROM bounties WHERE guild_id = $1 AND status IN ('claimed','paid') AND winner_username IS NOT NULL AND winner_username != 'N/A' GROUP BY winner_username ORDER BY wins DESC LIMIT $2\`, [guildId, limit]);
  return res.rows;
}

// ─── Hangry Games (per-guild) ───────────────────────────────────────────────

async function ensureHangryTables() {
  await query(\`
    CREATE TABLE IF NOT EXISTS hangry_games (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT NOT NULL,
      game_number INTEGER,
      total_players INTEGER,
      winner TEXT,
      total_deaths INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      total_suicides INTEGER DEFAULT 0,
      total_votes INTEGER DEFAULT 0,
      total_avenges INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  \`);
  await query(\`
    CREATE TABLE IF NOT EXISTS hangry_events (
      id SERIAL PRIMARY KEY,
      guild_id TEXT,
      channel_id TEXT NOT NULL,
      game_number INTEGER,
      type TEXT NOT NULL,
      killer TEXT,
      victim TEXT,
      avenger TEXT,
      avenged TEXT,
      death_number INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  \`);
  await query(\`ALTER TABLE hangry_games ADD COLUMN IF NOT EXISTS guild_id TEXT\`).catch(() => {});
  await query(\`ALTER TABLE hangry_events ADD COLUMN IF NOT EXISTS guild_id TEXT\`).catch(() => {});
}

async function logHangryGame(data) {
  await ensureHangryTables();
  const res = await query(\`INSERT INTO hangry_games (guild_id, channel_id, game_number, total_players, status) VALUES ($1,$2,$3,$4,'active') RETURNING *\`,
    [data.guildId || null, data.channelId, data.gameNumber || null, data.totalPlayers || null]);
  return res.rows[0];
}

async function logHangryEvent(data) {
  await ensureHangryTables();
  await query(\`INSERT INTO hangry_events (guild_id, channel_id, game_number, type, killer, victim, avenger, avenged, death_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)\`,
    [data.guildId || null, data.channelId, data.gameNumber || null, data.type, data.killer || null, data.victim || null,
     data.avenge?.avenger || null, data.avenge?.avenged || null, data.deathNumber || null]);
}

async function logHangryWinner(data) {
  await ensureHangryTables();
  await query(\`UPDATE hangry_games SET winner=$1, total_deaths=$2, total_kills=$3, total_suicides=$4, total_avenges=$5, status='ended', ended_at=NOW() WHERE channel_id=$6 AND game_number=$7 AND status='active'\`,
    [data.winner, data.totalDeaths, data.kills?.length || 0, data.suicides?.length || 0, data.avenges?.length || 0, data.channelId, data.gameNumber]);
}

async function getHangryStats(limit = 15) {
  await ensureHangryTables();
  const wins = await query(\`SELECT winner, COUNT(*) as wins FROM hangry_games WHERE status='ended' AND winner IS NOT NULL GROUP BY winner ORDER BY wins DESC LIMIT $1\`, [limit]);
  const kills = await query(\`SELECT killer, COUNT(*) as kills FROM hangry_events WHERE type='kill' AND killer IS NOT NULL GROUP BY killer ORDER BY kills DESC LIMIT $1\`, [limit]);
  const suicides = await query(\`SELECT victim, COUNT(*) as suicides FROM hangry_events WHERE type='suicide' AND victim IS NOT NULL GROUP BY victim ORDER BY suicides DESC LIMIT $1\`, [limit]);
  const avenges = await query(\`SELECT avenger, COUNT(*) as avenges FROM hangry_events WHERE type='kill' AND avenger IS NOT NULL GROUP BY avenger ORDER BY avenges DESC LIMIT $1\`, [limit]);
  return { wins: wins.rows, kills: kills.rows, suicides: suicides.rows, avenges: avenges.rows };
}

async function getHangryPlayerStats(username) {
  await ensureHangryTables();
  const wins = await query(\`SELECT COUNT(*) as count FROM hangry_games WHERE LOWER(winner)=LOWER($1) AND status='ended'\`, [username]);
  const kills = await query(\`SELECT COUNT(*) as count FROM hangry_events WHERE LOWER(killer)=LOWER($1) AND type='kill'\`, [username]);
  const deaths = await query(\`SELECT COUNT(*) as count FROM hangry_events WHERE LOWER(victim)=LOWER($1) AND type IN ('kill','suicide','vote')\`, [username]);
  const suicides = await query(\`SELECT COUNT(*) as count FROM hangry_events WHERE LOWER(victim)=LOWER($1) AND type='suicide'\`, [username]);
  const avenges = await query(\`SELECT COUNT(*) as count FROM hangry_events WHERE LOWER(avenger)=LOWER($1) AND type='kill'\`, [username]);
  const timesAvenged = await query(\`SELECT COUNT(*) as count FROM hangry_events WHERE LOWER(victim)=LOWER($1) AND avenger IS NOT NULL\`, [username]);
  return {
    wins: parseInt(wins.rows[0].count), kills: parseInt(kills.rows[0].count),
    deaths: parseInt(deaths.rows[0].count), suicides: parseInt(suicides.rows[0].count),
    avenges: parseInt(avenges.rows[0].count), timesAvenged: parseInt(timesAvenged.rows[0].count),
  };
}

async function getHangryGame(gameNumber) {
  await ensureHangryTables();
  const game = await query(\`SELECT * FROM hangry_games WHERE game_number=$1 ORDER BY id DESC LIMIT 1\`, [gameNumber]);
  if (!game.rows[0]) return null;
  const events = await query(\`SELECT * FROM hangry_events WHERE game_number=$1 ORDER BY death_number ASC\`, [gameNumber]);
  return { ...game.rows[0], events: events.rows };
}

module.exports.setGuildConfig = setGuildConfig;
module.exports.getGuildConfig = getGuildConfig;
module.exports.createBountySession = createBountySession;
module.exports.getActiveBountySessions = getActiveBountySessions;
module.exports.getAllBountySessions = getAllBountySessions;
module.exports.getBountySessionById = getBountySessionById;
module.exports.endBountySession = endBountySession;
module.exports.addBounty = addBounty;
module.exports.getBounties = getBounties;
module.exports.getAllSessionBounties = getAllSessionBounties;
module.exports.getActiveBountiesForGuild = getActiveBountiesForGuild;
module.exports.getPendingPayoutBounties = getPendingPayoutBounties;
module.exports.getBountyById = getBountyById;
module.exports.approveBounty = approveBounty;
module.exports.rejectBounty = rejectBounty;
module.exports.resolveBounty = resolveBounty;
module.exports.markBountyPaid = markBountyPaid;
module.exports.removeBounty = removeBounty;
module.exports.editBounty = editBounty;
module.exports.getBountyStats = getBountyStats;
module.exports.logHangryGame = logHangryGame;
module.exports.logHangryEvent = logHangryEvent;
module.exports.logHangryWinner = logHangryWinner;
module.exports.getHangryStats = getHangryStats;
module.exports.getHangryPlayerStats = getHangryPlayerStats;
module.exports.getHangryGame = getHangryGame;
`;

c = c + newFunctions;
fs.writeFileSync('src/db/database.js', c);
console.log('Full system DB patch applied');
