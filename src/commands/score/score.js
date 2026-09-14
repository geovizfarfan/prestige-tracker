// src/commands/score/score.js
const { SlashCommandBuilder } = require('discord.js');
const { requireScorePermission } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { updateScoreboard } = require('../../utils/scoreboardUpdater');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('score')
    .setDescription('Add or remove team points')

    .addSubcommand(s => s.setName('add').setDescription('Add points to a member')
      .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(o => o.setName('points').setDescription('Points to add').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))

    .addSubcommand(s => s.setName('remove').setDescription('Remove points from a member')
      .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(o => o.setName('points').setDescription('Points to remove').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))

    .addSubcommand(s => s.setName('team-add').setDescription('Add bonus points directly to a team total')
      .addRoleOption(o => o.setName('team_role').setDescription('Team role').setRequired(true))
      .addIntegerOption(o => o.setName('points').setDescription('Points to add').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))

    .addSubcommand(s => s.setName('team-remove').setDescription('Remove bonus points from a team total')
      .addRoleOption(o => o.setName('team_role').setDescription('Team role').setRequired(true))
      .addIntegerOption(o => o.setName('points').setDescription('Points to remove').setMinValue(1).setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))),

  async execute(interaction) {
    if (!await requireScorePermission(interaction)) return;
    const sub = interaction.options.getSubcommand();
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
    const points = interaction.options.getInteger('points');
    const reason = interaction.options.getString('reason');

    if (sub === 'add' || sub === 'remove') {
      const target = interaction.options.getUser('user');
      const member = await db.getMember(session.id, target.id);
      if (!member) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not in the session.`)], ephemeral: true });
      const delta = sub === 'add' ? points : -points;
      const updated = await db.updateMemberScore(session.id, target.id, delta);
      await db.logScore({ session_id: session.id, target_type: 'member', target_id: target.id, target_name: target.username, change: delta, reason, admin_id: interaction.user.id, admin_username: interaction.user.username });
      await updateScoreboard(interaction.client);
      const sign = sub === 'add' ? '+' : '-';
      return interaction.reply({ embeds: [successEmbed(`${sign}**${points}** pts → **${target.username}** *(${updated.team_name || 'No Team'})*\nScore: \`${updated.individual_score} pts\`${reason ? `\nReason: ${reason}` : ''}`)] });
    }

    if (sub === 'team-add' || sub === 'team-remove') {
      const role = interaction.options.getRole('team_role');
      const team = await db.getTeamByRole(session.id, role.id);
      if (!team) return interaction.reply({ embeds: [errorEmbed('That role is not a team in this session.')], ephemeral: true });
      const delta = sub === 'team-add' ? points : -points;
      await db.addTeamScore(team.id, delta);
      await db.logScore({ session_id: session.id, target_type: 'team', target_id: String(team.id), target_name: team.name, change: delta, reason, admin_id: interaction.user.id, admin_username: interaction.user.username });
      await updateScoreboard(interaction.client);
      const sign = sub === 'team-add' ? '+' : '-';
      return interaction.reply({ embeds: [successEmbed(`${sign}**${points}** bonus pts → **${team.name}**${reason ? `\nReason: ${reason}` : ''}`)] });
    }
  },
};
