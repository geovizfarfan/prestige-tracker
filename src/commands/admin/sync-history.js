const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-history')
    .setDescription('Save current/last session member scores to history (use if game-end was run before this feature)'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    // Get the most recently ended session
    const res = await db.query(`SELECT * FROM sessions WHERE status = 'ended' ORDER BY id DESC LIMIT 1`);
    const session = res.rows[0];
    if (!session) return interaction.editReply({ embeds: [errorEmbed('No ended session found.')] });

    // Check if history already exists for this session
    const existing = await db.query(`SELECT COUNT(*) as count FROM member_history WHERE session_id = $1`, [session.id]);
    if (parseInt(existing.rows[0].count) > 0) {
      return interaction.editReply({ embeds: [errorEmbed(`History for **${session.name}** already exists (${existing.rows[0].count} members).`)] });
    }

    // Get members from that session
    const members = await db.getMembersBySession(session.id);
    if (!members.length) return interaction.editReply({ embeds: [errorEmbed('No members found in that session.')] });

    await db.saveMemberHistory(session.id, members);

    await interaction.editReply({ embeds: [successEmbed(`Synced **${members.length} members** from session **${session.name}** to history!`)] });
  },
};
