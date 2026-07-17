const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { buildTeamSessionEmbed, buildJoinLateButton, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-teams')
    .setDescription('Re-post the Team Sessions embed with the Join Late button'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });

    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    const embed = buildTeamSessionEmbed(session, teams, members);
    await interaction.reply({ embeds: [embed], components: [buildJoinLateButton()] });
  },
};
