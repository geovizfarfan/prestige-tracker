const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('set-start-date')
      .setDescription('Set the start date for the current session')
      .addStringOption(o => o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true)),
    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const date = interaction.options.getString('date');
      if (isNaN(Date.parse(date))) return interaction.reply({ embeds: [errorEmbed('Invalid date. Use YYYY-MM-DD.')], ephemeral: true });
      await db.updateSession(session.id, { start_date: date });
      await interaction.reply({ embeds: [successEmbed(`Start date set to **${date}**`)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('set-end-date')
      .setDescription('Set the end date for the current session')
      .addStringOption(o => o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true)),
    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
      const date = interaction.options.getString('date');
      if (isNaN(Date.parse(date))) return interaction.reply({ embeds: [errorEmbed('Invalid date. Use YYYY-MM-DD.')], ephemeral: true });
      await db.updateSession(session.id, { end_date: date });
      await interaction.reply({ embeds: [successEmbed(`End date set to **${date}**`)] });
    },
  },
];
