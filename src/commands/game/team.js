// src/commands/game/team.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const {
  TEAM_EMOJIS, buildSignupEmbed, buildSignupButtons, buildWinnerEmbed,
  buildTeamSessionEmbed, buildJoinLateButton, buildSessionInfoEmbed,
  errorEmbed, successEmbed, COLORS,
} = require('../../utils/embeds');

const DEFAULT_TEAMS = [
  { name: 'Team Alpha', emoji: '' },
  { name: 'Team Bravo', emoji: '' },
  { name: 'Team Charlie', emoji: '' },
  { name: 'Team Delta', emoji: '' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage team game sessions')

    .addSubcommand(s => s.setName('start').setDescription('[ADMIN] Start a new team game session with signups')
      .addStringOption(o => o.setName('name').setDescription('Session name').setRequired(false))
      .addIntegerOption(o => o.setName('teams').setDescription('Number of teams (2-10)').setMinValue(2).setMaxValue(10).setRequired(false))
      .addStringOption(o => o.setName('team_names').setDescription('Comma-separated team names').setRequired(false)))

    .addSubcommand(s => s.setName('end').setDescription('[ADMIN] End the current game session and display final results'))

    .addSubcommand(s => s.setName('cancel').setDescription('[ADMIN] Cancel and delete the current session without saving history'))

    .addSubcommand(s => s.setName('repost').setDescription('[ADMIN] Re-post the Team Sessions embed with the Join Late button'))

    .addSubcommand(s => s.setName('info').setDescription('Show info about the current active session'))

    .addSubcommand(s => s.setName('history').setDescription('View all members who were on a team in a past session and their scores')
      .addStringOption(o => o.setName('team_name').setDescription('Team name to look up').setRequired(true))
      .addIntegerOption(o => o.setName('limit').setDescription('Number of sessions to show (default 5)').setMinValue(1).setMaxValue(10).setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!await requireAdmin(interaction)) return;
      const existing = await db.getActiveSession();
      if (existing) {
        return interaction.reply({ embeds: [errorEmbed('A session is already active. Use `/team end` first.')], ephemeral: true });
      }
      const name = interaction.options.getString('name') || 'Season 1';
      const teamCount = interaction.options.getInteger('teams') || 4;
      const teamNamesRaw = interaction.options.getString('team_names');

      const session = await db.createSession(name);
      await db.updateSession(session.id, { status: 'signup' });

      let teamDefs = [];
      if (teamNamesRaw) {
        const names = teamNamesRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
        teamDefs = names.map(n => ({ name: n, emoji: '' }));
      } else {
        for (let i = 0; i < teamCount; i++) {
          teamDefs.push(DEFAULT_TEAMS[i] || { name: `Team ${String.fromCharCode(65 + i)}`, emoji: '' });
        }
      }

      const guild = interaction.guild;
      const teams = [];
      for (const def of teamDefs) {
        let role = null;
        try {
          role = await guild.roles.create({ name: def.name, reason: `Prestige Tracker — ${name}` });
        } catch (e) {
          console.warn(`Could not create role for ${def.name}:`, e.message);
        }
        const team = await db.createTeam(session.id, def.name, def.emoji, role?.id || null);
        teams.push(team);
      }

      const signups = await db.getSignups(session.id);
      const embed = buildSignupEmbed(session, teams, signups, null);
      const row = buildSignupButtons();
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      return db.updateSession(session.id, { signup_channel_id: interaction.channelId, signup_message_id: msg.id });
    }

    if (sub === 'end') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      await interaction.deferReply();

      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      if (!teams.length) return interaction.editReply({ embeds: [errorEmbed('No teams found.')] });

      const sorted = [...teams].sort((a, b) => b.total_score - a.total_score);
      const winner = sorted[0];
      const mvp = [...members].sort((a, b) => b.individual_score - a.individual_score)[0];

      await db.saveHistory({
        session_id: session.id, session_name: session.name,
        winning_team: `${winner.emoji} ${winner.name}`, winning_score: winner.total_score,
        mvp_user_id: mvp?.user_id || null, mvp_username: mvp?.username || null, mvp_score: mvp?.individual_score || null,
        start_date: session.start_date, end_date: session.end_date,
        team_results: sorted.map(t => ({ name: t.name, emoji: t.emoji, score: t.total_score })),
      });
      await db.saveMemberHistory(session.id, members);
      await db.updateSession(session.id, { status: 'ended', ended_at: new Date().toISOString() });

      const guild = interaction.guild;
      for (const team of teams) {
        if (!team.role_id) continue;
        try {
          const teamMembers = members.filter(m => m.team_id === team.id);
          for (const m of teamMembers) {
            const gm = await guild.members.fetch(m.user_id).catch(() => null);
            if (gm) await gm.roles.remove(team.role_id).catch(() => {});
          }
          const role = guild.roles.cache.get(team.role_id);
          if (role) await role.delete('Session ended').catch(() => {});
        } catch {}
      }

      if (session.signup_message_id && session.signup_channel_id) {
        try {
          const ch = await guild.channels.fetch(session.signup_channel_id);
          const msg = await ch.messages.fetch(session.signup_message_id);
          await msg.edit({ components: [buildSignupButtons(true)] });
        } catch {}
      }

      const embed = buildWinnerEmbed(session, winner, sorted, members);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'cancel') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession() || await db.getPendingSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active or pending session.')], ephemeral: true });

      const teams = await db.getTeamsBySession(session.id);
      const guild = interaction.guild;
      for (const team of teams) {
        if (!team.role_id) continue;
        try {
          const members = await db.getMembersByTeam(team.id);
          for (const m of members) {
            const gm = await guild.members.fetch(m.user_id).catch(() => null);
            if (gm) await gm.roles.remove(team.role_id).catch(() => {});
          }
          const role = guild.roles.cache.get(team.role_id);
          if (role) await role.delete('Session cancelled').catch(() => {});
        } catch {}
      }

      if (session.signup_message_id && session.signup_channel_id) {
        try {
          const ch = await guild.channels.fetch(session.signup_channel_id);
          const msg = await ch.messages.fetch(session.signup_message_id);
          await msg.edit({ components: [buildSignupButtons(true)] });
        } catch {}
      }

      await db.updateSession(session.id, { status: 'ended' });
      return interaction.reply({ embeds: [successEmbed(`Session **${session.name}** has been cancelled.`)] });
    }

    if (sub === 'repost') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      const embed = buildTeamSessionEmbed(session, teams, members);
      return interaction.reply({ embeds: [embed], components: [buildJoinLateButton()] });
    }

    if (sub === 'info') {
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      const signups = await db.getSignups(session.id);
      return interaction.reply({ embeds: [buildSessionInfoEmbed(session, teams, members, signups)] });
    }

    if (sub === 'history') {
      await interaction.deferReply();
      const teamName = interaction.options.getString('team_name');
      const limit = interaction.options.getInteger('limit') || 5;
      const history = await db.getTeamMemberHistory(teamName, limit);
      if (!history.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No history found for team **${teamName}**.`)] });
      }
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
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
