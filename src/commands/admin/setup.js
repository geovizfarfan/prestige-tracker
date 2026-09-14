// src/commands/admin/setup.js
const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const { buildMainPanel } = require('../../interactions/setupPanelHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('[ADMIN] Configure Prestige Tracker settings'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const panel = await buildMainPanel(interaction.guildId);
    await interaction.reply({ ...panel, ephemeral: true });
  },
};
