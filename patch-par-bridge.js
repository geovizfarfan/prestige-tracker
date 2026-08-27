const fs = require('fs');
const path = require('path');

const PAR = path.join(process.env.HOME, 'Play-&-Regret');

// ─── rumbleslaughter.js ────────────────────────────────────────────────────────
const rsPath = path.join(PAR, 'events', 'rumbleslaughter.js');
let rs = fs.readFileSync(rsPath, 'utf8');

// Add require at top if not already there
if (!rs.includes('prestige-bridge')) {
  rs = rs.replace(
    "const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');",
    "const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');\nconst prestige = require('../utils/prestige-bridge');"
  );
  console.log('✅ Added prestige-bridge require to rumbleslaughter.js');
}

// Add kill event log right after: events.push(`⚔️ ${fightLine}`);
if (!rs.includes('prestige.logKill') && rs.includes("events.push(`⚔️ ${fightLine}`);")) {
  rs = rs.replace(
    "events.push(`⚔️ ${fightLine}`);",
    "events.push(`⚔️ ${fightLine}`);\n        prestige.logKill(channel.guild?.id, channel.id, 'rumbleslaughter', getDisplayName(winner), winner.user_id, getDisplayName(loser), loser.user_id).catch(() => {});"
  );
  console.log('✅ Added kill logging to rumbleslaughter.js');
}

// Add winner log right before the channel.send CHAMPION embed
if (!rs.includes('prestige.logWinner') && rs.includes("'👑 RUMBLE SLAUGHTER — CHAMPION'")) {
  rs = rs.replace(
    "const winLine = pick(WIN_LINES).replace('@winner', `**${getDisplayName(winner)}**`);",
    "const winLine = pick(WIN_LINES).replace('@winner', `**${getDisplayName(winner)}**`);\n    prestige.logWinner(channel.guild?.id, channel.id, 'rumbleslaughter', getDisplayName(winner), winner.user_id).catch(() => {});"
  );
  console.log('✅ Added winner logging to rumbleslaughter.js');
}

// Add suicide/elim log — find ELIM_LINES usage
if (!rs.includes('prestige.logSuicide') && rs.includes('pick(ELIM_LINES)')) {
  rs = rs.replace(
    "const elimLine = pick(ELIM_LINES).replace('@user', `**${getDisplayName(p)}**`);",
    "const elimLine = pick(ELIM_LINES).replace('@user', `**${getDisplayName(p)}**`);\n      prestige.logSuicide(channel.guild?.id, channel.id, 'rumbleslaughter', getDisplayName(p), p.user_id).catch(() => {});"
  );
  console.log('✅ Added suicide/elim logging to rumbleslaughter.js');
} else if (!rs.includes('prestige.logSuicide')) {
  // Fallback — find where individual elims are posted
  rs = rs.replace(
    "events.push(`💀 ${elimLine}`);",
    "events.push(`💀 ${elimLine}`);\n      prestige.logSuicide(channel.guild?.id, channel.id, 'rumbleslaughter', getDisplayName(p), p.user_id).catch(() => {});"
  );
  console.log('✅ Added suicide/elim logging (fallback) to rumbleslaughter.js');
}

fs.writeFileSync(rsPath, rs);
console.log('✅ rumbleslaughter.js patched\n');

// ─── autogames.js ──────────────────────────────────────────────────────────────
const agPath = path.join(PAR, 'events', 'autogames.js');
let ag = fs.readFileSync(agPath, 'utf8');

// Add require at top
if (!ag.includes('prestige-bridge')) {
  ag = ag.replace(
    /^(const .+require\('discord\.js'\);)/m,
    "$1\nconst prestige = require('../utils/prestige-bridge');"
  );
  console.log('✅ Added prestige-bridge require to autogames.js');
}

// Add winner log before the champion embed
if (!ag.includes('prestige.logWinner') && ag.includes("const label = type === 'hungergames'")) {
  ag = ag.replace(
    "const label = type === 'hungergames' ? '🏹 Victor' : '⚔️ Champion';",
    `// Log winners to Prestige Tracker
  for (const w of winners) {
    const gameType = type === 'hungergames' ? 'regretgames' : type === 'rumble' ? 'rumbleslaughter_ar' : type;
    prestige.logWinner(channel.guild?.id, channel.id, gameType, w.username, w.id).catch(() => {});
  }
  const label = type === 'hungergames' ? '🏹 Victor' : '⚔️ Champion';`
  );
  console.log('✅ Added winner logging to autogames.js');
}

// Add kill log in hunger games kill section
if (!ag.includes('prestige.logKill') && ag.includes("kills.push(")) {
  ag = ag.replace(
    "kills.push(",
    "prestige.logKill(channel.guild?.id, channel.id, 'regretgames', attacker.username, attacker.id, defender.username, defender.id).catch(() => {});\n      kills.push("
  );
  console.log('✅ Added kill logging to autogames.js');
}

fs.writeFileSync(agPath, ag);
console.log('✅ autogames.js patched\n');

console.log('🎉 Play & Regret bridge patch complete!');
console.log('Now deploy Play & Regret: cd ~/Play-\\&-Regret && railway up --detach');
