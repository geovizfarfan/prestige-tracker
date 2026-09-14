// src/commands/admin/member-admin.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed, buildMemberInfoEmbed, COLORS, RANK_MEDALS } = require('../../utils/embeds');
const { getSmallestTeam } = require('../../utils/randomizer');
const { updateScoreboard } = require('../../utils/scoreboardUpdater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member')
    .setDescription('Manage session members')

    .addSubcommand(s => s.setName('add').setDescription('[ADMIN] Manually add a member to the session')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true))
      .addRoleOption(o => o.setName('team_role').setDescription('Assign to specific team (optional)').setRequired(false)))

    .addSubcommand(s => s.setName('remove').setDescription('[ADMIN] Remove a member from the current session')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))

    .addSubcommand(s => s.setName('move').setDescription('[ADMIN] Move a member to a different team')
      .addUserOption(o => o.setName('user').setDescription('User to move').setRequired(true))
      .addRoleOption(o => o.setName('team_role').setDescription('New team role').setRequired(true)))

    .addSubcommand(s => s.setName('info').setDescription("View a member's team and score")
      .addUserOption(o => o.setName('user').setDescription('Member to view').setRequired(true)))

    .addSubcommand(s => s.setName('list').setDescription('List all members in the current session'))

    .addSubcommand(s => s.setName('history').setDescription("View a member's score history across all sessions")
      .addUserOption(o => o.setName('user').setDescription('Member to look up').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const roleOpt = interaction.options.getRole('team_role');
      const teams = await db.getTeamsBySession(session.id);
      if (!teams.length) return interaction.reply({ embeds: [errorEmbed('No teams exist yet.')], ephemeral: true });
      let team;
      if (roleOpt) {
        team = await db.getTeamByRole(session.id, roleOpt.id);
        if (!team) return interaction.reply({ embeds: [errorEmbed('That role is not a team in this session.')], ephemeral: true });
      } else {
        const members = await db.getMembersBySession(session.id);
        team = getSmallestTeam(teams, members);
      }
      const added = await db.addMember(session.id, target.id, target.username, team.id);
      if (!added) return interaction.reply({ embeds: [errorEmbed(`${target.username} is already in this session.`)], ephemeral: true });
      if (team.role_id) {
        const gm = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (gm) await gm.roles.add(team.role_id).catch(() => {});
      }
      await updateScoreboard(interaction.client);
      return interaction.reply({ embeds: [successEmbed(`**${target.username}** added to **${team.name}**`)] });
    }

    if (sub === 'remove') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const member = await db.removeMember(session.id, target.id);
      if (!member) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not in this session.`)], ephemeral: true });
      if (member.role_id) {
        const gm = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (gm) await gm.roles.remove(member.role_id).catch(() => {});
      }
      await updateScoreboard(interaction.client);
      return interaction.reply({ embeds: [successEmbed(`**${target.username}** removed from the session.`)] });
    }

    if (sub === 'move') {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const role = interaction.options.getRole('team_role');
      const newTeam = await db.getTeamByRole(session.id, role.id);
      if (!newTeam) return interaction.reply({ embeds: [errorEmbed('That role is not a team in this session.')], ephemeral: true });
      const oldMember = await db.getMember(session.id, target.id);
      if (!oldMember) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not in this session.`)], ephemeral: true });
      const gm = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (gm && oldMember.role_id) await gm.roles.remove(oldMember.role_id).catch(() => {});
      if (gm && newTeam.role_id) await gm.roles.add(newTeam.role_id).catch(() => {});
      await db.moveMember(session.id, target.id, newTeam.id);
      await updateScoreboard(interaction.client);
      return interaction.reply({ embeds: [successEmbed(`**${target.username}** moved to **${newTeam.name}**`)], ephemeral: true });
    }

    if (sub === 'info') {
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const target = interaction.options.getUser('user');
      const member = await db.getMember(session.id, target.id);
      if (!member) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not in this session.`)], ephemeral: true });
      return interaction.reply({ embeds: [buildMemberInfoEmbed(member, session)] });
    }

    if (sub === 'list') {
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const members = await db.getMembersBySession(session.id);
      if (!members.length) return interaction.reply({ embeds: [errorEmbed('No members in session.')], ephemeral: true });
      const teams = await db.getTeamsBySession(session.id);
      const fields = teams.map(team => {
        const tm = members.filter(m => m.team_id === team.id);
        return {
          name: `${team.name} (${tm.length})`,
          value: tm.map(m => `• **${m.username}** — \`${m.individual_score} pts\``).join('\n') || '*Empty*',
          inline: true,
        };
      });
      const embed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`👥  Members — ${session.name}`)
        .setDescription(`**Total players:** \`${members.length}\``)
        .addFields(fields)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'history') {
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
      return interaction.reply({ embeds: [embed] });
    }
  },
};
