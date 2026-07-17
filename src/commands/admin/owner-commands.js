const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { requireOwner, requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed, buildScoreboardEmbed, buildTeamLeaderboardEmbed, buildHistoryEmbed, COLORS, RANK_MEDALS } = require('../../utils/embeds');
const { buildMemberLeaderboardPage } = require('../../utils/buildMemberLeaderboardPage');

function buildLeaderboardTabs(active, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb_teams_${userId}`).setLabel('Team Leaderboard').setEmoji({ id: '1490116121800605921', name: 'trophy', animated: true }).setStyle(active === 'teams' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_members_${userId}`).setLabel('Member Leaderboard').setEmoji({ id: '1490131407903653949', name: 'star1', animated: true }).setStyle(active === 'members' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_history_${userId}`).setLabel('Session History').setEmoji({ id: '1490144538688487454', name: '20937blueheartfolder', animated: false }).setStyle(active === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('bot-reset')
      .setDescription('[OWNER ONLY] Fully reset the bot — deletes ALL data permanently'),
    async execute(interaction) {
      if (!await requireOwner(interaction)) return;
      const confirm = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reset_confirm').setLabel('Yes, Reset Everything').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('reset_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ embeds: [errorEmbed('⚠️ **This will permanently delete all data.** Are you sure?')], components: [confirm], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('scoreboard-post')
      .setDescription('Post the live scoreboard in this channel'),
    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      const embed = buildScoreboardEmbed(session, teams, members);
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await db.updateSession(session.id, { scoreboard_channel_id: interaction.channelId, scoreboard_message_id: msg.id });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('history')
      .setDescription('View past session history and winners')
      .addIntegerOption(o => o.setName('limit').setDescription('Number of sessions to show (max 10)').setMinValue(1).setMaxValue(10).setRequired(false)),
    async execute(interaction) {
      const limit = interaction.options.getInteger('limit') || 5;
      const history = await db.getHistory(limit);
      await interaction.reply({ embeds: [buildHistoryEmbed(history)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('member-history')
      .setDescription('View a member\'s score history across all sessions')
      .addUserOption(o => o.setName('user').setDescription('Member to look up').setRequired(true)),
    async execute(interaction) {
      const target = interaction.options.getUser('user');
      const history = await db.getMemberHistory(target.id);

      const lines = history.length > 0
        ? history.map((h, i) => {
            const medal = RANK_MEDALS[i] || '<a:completed:1490144466668097668>';
            const date = h.session_ended ? `<t:${Math.floor(new Date(h.session_ended).getTime() / 1000)}:D>` : 'Unknown';
            return `${medal} **${h.session_name || 'Unknown Session'}**  ·  ${date}\n> Team: **${h.team_name || 'N/A'}**  ·  Score: \`${h.individual_score} pts\``;
          }).join('\n\n')
        : '*No session history found for this member.*';

      const embed = new EmbedBuilder()
        .setColor(COLORS.purple)
        .setTitle(`<:members:1490116112585724034>  ${target.username} — Session History`)
        .setDescription(lines)
        .setFooter({ text: 'Prestige Tracker' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('team-history')
      .setDescription('View all members who were on a team in a past session and their scores')
      .addStringOption(o => o.setName('team_name').setDescription('Team name to look up').setRequired(true))
      .addIntegerOption(o => o.setName('limit').setDescription('Number of sessions to show (default 5)').setMinValue(1).setMaxValue(10).setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply();
      const teamName = interaction.options.getString('team_name');
      const limit = interaction.options.getInteger('limit') || 5;
      const history = await db.getTeamMemberHistory(teamName, limit);

      if (!history.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No history found for team **${teamName}**.`)] });
      }

      // Group by session
      const sessions = {};
      for (const row of history) {
        const key = row.session_name || `Session ${row.session_id}`;
        if (!sessions[key]) sessions[key] = { date: row.session_ended, members: [] };
        sessions[key].members.push(row);
      }

      const lines = Object.entries(sessions).map(([name, data]) => {
        const date = data.date ? `<t:${Math.floor(new Date(data.date).getTime() / 1000)}:D>` : 'Unknown';
        const memberLines = data.members
          .sort((a, b) => b.individual_score - a.individual_score)
          .map(m => `> • **${m.username}** — \`${m.individual_score} pts\``)
          .join('\n');
        return `**${name}**  ·  ${date}\n${memberLines}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle(`<a:trophy:1490116121800605921>  Team History — ${teamName}`)
        .setDescription(lines)
        .setFooter({ text: 'Prestige Tracker' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show team leaderboard, member leaderboard, and session history'),
    async execute(interaction) {
      const userId = interaction.user.id;
      const session = await db.getActiveSession();

      if (!session) {
        const history = await db.getHistory(5);
        const tabRow = buildLeaderboardTabs('history', userId);
        return interaction.reply({ embeds: [buildHistoryEmbed(history)], components: [tabRow] });
      }

      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      const { embed, row } = buildMemberLeaderboardPage(session, members, 0, userId);
      const tabRow = buildLeaderboardTabs('members', userId);
      await interaction.reply({ embeds: [embed], components: [tabRow, row] });
    },
  },
];
