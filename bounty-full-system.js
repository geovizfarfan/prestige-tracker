const fs = require('fs');
let c = fs.readFileSync('src/db/database.js', 'utf8');

// Replace ensureBountyTable to add pending/approval/paid columns
c = c.replace(
  /async function ensureBountyTable\(\) \{[\s\S]*?\n\}/,
  `async function ensureBountyTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounties (
      id SERIAL PRIMARY KEY,
      session_id INTEGER,
      channel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      prize TEXT NOT NULL,
      payee_id TEXT NOT NULL,
      payee_username TEXT NOT NULL,
      target_id TEXT,
      target_username TEXT,
      death_number INTEGER,
      role_id TEXT,
      role_name TEXT,
      set_by_id TEXT NOT NULL,
      set_by_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      winner_id TEXT,
      winner_username TEXT,
      game_link TEXT,
      paid INTEGER DEFAULT 0,
      rejected_reason TEXT,
      reviewed_by_id TEXT,
      reviewed_by_username TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ
    )
  \`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS game_link TEXT\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS session_id INTEGER\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS paid INTEGER DEFAULT 0\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS rejected_reason TEXT\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS reviewed_by_id TEXT\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS reviewed_by_username TEXT\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ\`);
}`
);

// Replace addBounty - status starts as 'pending'
c = c.replace(
  /async function addBounty\(data\) \{[\s\S]*?\n\}/,
  `async function addBounty(data) {
  await ensureBountyTable();
  const res = await query(\`
    INSERT INTO bounties (session_id, channel_id, type, prize, payee_id, payee_username, target_id, target_username, death_number, role_id, role_name, set_by_id, set_by_username, game_link, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending') RETURNING *
  \`, [data.session_id || null, data.channel_id, data.type, data.prize, data.payee_id, data.payee_username, data.target_id, data.target_username, data.death_number, data.role_id, data.role_name, data.set_by_id, data.set_by_username, data.game_link || null]);
  return res.rows[0];
}`
);

// Replace getBounties - only show approved (active) bounties, filter by session
c = c.replace(
  /async function getBounties\(channelIdOrSessionId, bySession = false\) \{[\s\S]*?\n\}/,
  `async function getBounties(sessionId) {
  await ensureBountyTable();
  const res = await query(\`SELECT * FROM bounties WHERE session_id = $1 AND status = 'active' ORDER BY id ASC\`, [sessionId]);
  return res.rows;
}`
);

// Add new functions: approveBounty, rejectBounty, markPaid, getPendingBounty, config channels
const newFunctions = `

async function approveBounty(id, reviewerId, reviewerUsername) {
  await query(\`UPDATE bounties SET status = 'active', reviewed_by_id = $1, reviewed_by_username = $2 WHERE id = $3\`, [reviewerId, reviewerUsername, id]);
  return getBountyById(id);
}

async function rejectBounty(id, reviewerId, reviewerUsername, reason) {
  await query(\`UPDATE bounties SET status = 'rejected', reviewed_by_id = $1, reviewed_by_username = $2, rejected_reason = $3 WHERE id = $4\`, [reviewerId, reviewerUsername, reason || null, id]);
  return getBountyById(id);
}

async function markBountyPaid(id) {
  await query(\`UPDATE bounties SET paid = 1, paid_at = NOW() WHERE id = $1\`, [id]);
  return getBountyById(id);
}

async function ensureConfigTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounty_config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  \`);
}

async function setConfig(key, value) {
  await ensureConfigTable();
  await query(\`INSERT INTO bounty_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2\`, [key, value]);
}

async function getConfig(key) {
  await ensureConfigTable();
  const res = await query('SELECT value FROM bounty_config WHERE key = $1', [key]);
  return res.rows[0]?.value || null;
}

module.exports.approveBounty = approveBounty;
module.exports.rejectBounty = rejectBounty;
module.exports.markBountyPaid = markBountyPaid;
module.exports.setConfig = setConfig;
module.exports.getConfig = getConfig;
`;

c = c.replace("module.exports.editBounty = editBounty;", "module.exports.editBounty = editBounty;" + newFunctions);

fs.writeFileSync('src/db/database.js', c);
console.log('Full bounty system database patch applied');
