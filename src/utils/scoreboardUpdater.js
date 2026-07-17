const { buildScoreboardEmbed } = require('./embeds');
const db = require('../db/database');

async function updateScoreboard(client) {
  try {
    const session = await db.getActiveSession();
    if (!session || !session.scoreboard_message_id || !session.scoreboard_channel_id) return;
    const channel = await client.channels.fetch(session.scoreboard_channel_id).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(session.scoreboard_message_id).catch(() => null);
    if (!message) return;
    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    const embed = buildScoreboardEmbed(session, teams, members);
    await message.edit({ embeds: [embed] });
  } catch (err) {
    console.error('[Scoreboard] Update error:', err.message);
  }
}

module.exports = { updateScoreboard };
