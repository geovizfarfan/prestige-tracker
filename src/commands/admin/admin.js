// src/commands/admin/admin.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed, buildHistoryEmbed, COLORS } = require('../../utils/embeds');
const { buildMemberLeaderboardPage } = require('../../utils/buildMemberLeaderboardPage');

function buildLeaderboardTabs(active, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb_teams_${userId}`).setLabel('Team Leaderboard').setEmoji({ id: '1490116121800605921', name: 'trophy', animated: true }).setStyle(active === 'teams' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_members_${userId}`).setLabel('Member Leaderboard').setEmoji({ id: '1490131407903653949', name: 'star1', animated: true }).setStyle(active === 'members' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_history_${userId}`).setLabel('Session History').setEmoji({ id: '1490144538688487454', name: '20937blueheartfolder', animated: false }).setStyle(active === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Reporting & maintenance utilities')

    .addSubcommand(s => s.setName('history').setDescription('View past session history and winners')
      .addIntegerOption(o => o.setName('limit').setDescription('Number of sessions to show (max 10)').setMinValue(1).setMaxValue(10).setRequired(false)))

    .addSubcommand(s => s.setName('leaderboard').setDescription('Show team leaderboard, member leaderboard, and session history'))

    .addSubcommand(s => s.setName('sync-history').setDescription("[ADMIN] Backfill last ended session's member scores into history")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'history') {
      const limit = interaction.options.getInteger('limit') || 5;
      const history = await db.getHistory(limit);
      return interaction.reply({ embeds: [buildHistoryEmbed(history)] });
    }

    if (sub === 'leaderboard') {
      const userId = interaction.user.id;
      const session = await db.getActiveSession();
      if (!session) {
        const history = await db.getHistory(5);
        const tabRow = buildLeaderboardTabs('history', userId);
        return interaction.reply({ embeds: [buildHistoryEmbed(history)], components: [tabRow] });
      }
      const members = await db.getMembersBySession(session.id);
      const { embed, row } = buildMemberLeaderboardPage(session, members, 0, userId);
      const tabRow = buildLeaderboardTabs('members', userId);
      return interaction.reply({ embeds: [embed], components: [tabRow, row] });
    }

    if (sub === 'sync-history') {
      if (!await requireAdmin(interaction)) return;
      await interaction.deferReply({ ephemeral: true });
      const res = await db.query(`SELECT * FROM sessions WHERE status = 'ended' ORDER BY id DESC LIMIT 1`);
      const session = res.rows[0];
      if (!session) return interaction.editReply({ embeds: [errorEmbed('No ended session found.')] });
      const existing = await db.query(`SELECT COUNT(*) as count FROM member_history WHERE session_id = $1`, [session.id]);
      if (parseInt(existing.rows[0].count) > 0) {
        return interaction.editReply({ embeds: [errorEmbed(`History for **${session.name}** already exists (${existing.rows[0].count} members).`)] });
      }
      const members = await db.getMembersBySession(session.id);
      if (!members.length) return interaction.editReply({ embeds: [errorEmbed('No members found in that session.')] });
      await db.saveMemberHistory(session.id, members);
      return interaction.editReply({ embeds: [successEmbed(`Synced **${members.length} members** from session **${session.name}** to history!`)] });
    }
  },
};
