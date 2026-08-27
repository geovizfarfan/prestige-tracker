const fs = require('fs');
let c = fs.readFileSync('src/db/database.js', 'utf8');

const sessionFunctions = `

// ─── Bounty Sessions ────────────────────────────────────────────────────────

async function ensureBountySessionTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounty_sessions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      game_channel_id TEXT NOT NULL,
      bounty_channel_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by_id TEXT NOT NULL,
      created_by_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  \`);
}

async function createBountySession(data) {
  await ensureBountySessionTable();
  const res = await query(\`
    INSERT INTO bounty_sessions (name, game_channel_id, bounty_channel_id, created_by_id, created_by_username)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  \`, [data.name, data.game_channel_id, data.bounty_channel_id || null, data.created_by_id, data.created_by_username]);
  return res.rows[0];
}

async function getActiveBountySessions() {
  await ensureBountySessionTable();
  const res = await query(\`SELECT * FROM bounty_sessions WHERE status = 'active' ORDER BY id DESC\`);
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

module.exports.createBountySession = createBountySession;
module.exports.getActiveBountySessions = getActiveBountySessions;
module.exports.getBountySessionById = getBountySessionById;
module.exports.endBountySession = endBountySession;
`;

c = c + sessionFunctions;
fs.writeFileSync('src/db/database.js', c);
console.log('Bounty session functions added');
