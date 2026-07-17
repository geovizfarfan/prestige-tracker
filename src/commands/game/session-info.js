const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db/database');
const { buildSessionInfoEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('session-info')
    .setDescription('Show info about the current active session'),

  async execute(interaction) {
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    const signups = await db.getSignups(session.id);
    await interaction.reply({ embeds: [buildSessionInfoEmbed(session, teams, members, signups)] });
  },
};
