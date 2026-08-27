const fs = require('fs');
let c = fs.readFileSync('src/db/database.js', 'utf8');

// Replace ensureBountyTable to add session_id column
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
      status TEXT NOT NULL DEFAULT 'active',
      winner_id TEXT,
      winner_username TEXT,
      game_link TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  \`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS game_link TEXT\`);
  await query(\`ALTER TABLE bounties ADD COLUMN IF NOT EXISTS session_id INTEGER\`);
}`
);

// Replace addBounty to include session_id
c = c.replace(
  /async function addBounty\(data\) \{[\s\S]*?\n\}/,
  `async function addBounty(data) {
  await ensureBountyTable();
  const res = await query(\`
    INSERT INTO bounties (session_id, channel_id, type, prize, payee_id, payee_username, target_id, target_username, death_number, role_id, role_name, set_by_id, set_by_username, game_link)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
  \`, [data.session_id || null, data.channel_id, data.type, data.prize, data.payee_id, data.payee_username, data.target_id, data.target_username, data.death_number, data.role_id, data.role_name, data.set_by_id, data.set_by_username, data.game_link || null]);
  return res.rows[0];
}`
);

// Replace getBounties to filter by session_id when provided, else channel
c = c.replace(
  /async function getBounties\(channelId\) \{[\s\S]*?\n\}/,
  `async function getBounties(channelIdOrSessionId, bySession = false) {
  await ensureBountyTable();
  if (bySession) {
    const res = await query(\`SELECT * FROM bounties WHERE session_id = $1 AND status = 'active' ORDER BY id ASC\`, [channelIdOrSessionId]);
    return res.rows;
  }
  const res = await query(\`SELECT * FROM bounties WHERE channel_id = $1 AND status = 'active' ORDER BY id ASC\`, [channelIdOrSessionId]);
  return res.rows;
}`
);

// Add removeBounty and editBounty functions before module.exports for bounties
const newFunctions = `

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

module.exports.removeBounty = removeBounty;
module.exports.editBounty = editBounty;
`;

c = c.replace(
  "module.exports.getBountyStats = getBountyStats;",
  "module.exports.getBountyStats = getBountyStats;" + newFunctions
);

fs.writeFileSync('src/db/database.js', c);
console.log('Bounty db patch v2 applied');
