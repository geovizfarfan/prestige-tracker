const fs = require('fs');
let c = fs.readFileSync('src/db/database.js', 'utf8');

// Add game_link column to bounty_sessions
c = c.replace(
  /async function ensureBountySessionTable\(\) \{[\s\S]*?\n\}/,
  `async function ensureBountySessionTable() {
  await query(\`
    CREATE TABLE IF NOT EXISTS bounty_sessions (
      id SERIAL PRIMARY KEY,
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
  await query(\`ALTER TABLE bounty_sessions ADD COLUMN IF NOT EXISTS game_link TEXT\`);
}`
);

// Update createBountySession to include game_link
c = c.replace(
  /async function createBountySession\(data\) \{[\s\S]*?\n\}/,
  `async function createBountySession(data) {
  await ensureBountySessionTable();
  const res = await query(\`
    INSERT INTO bounty_sessions (name, game_channel_id, bounty_channel_id, game_link, created_by_id, created_by_username)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  \`, [data.name, data.game_channel_id, data.bounty_channel_id || null, data.game_link || null, data.created_by_id, data.created_by_username]);
  return res.rows[0];
}`
);

fs.writeFileSync('src/db/database.js', c);
console.log('Session game_link patch applied');
