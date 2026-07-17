const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounty-clear')
    .setDescription('Clear all bounties for this channel (use when a new game starts)'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const count = await db.clearBounties(interaction.channelId);
    if (count === 0) {
      return interaction.reply({ embeds: [errorEmbed('No active bounties to clear in this channel.')], ephemeral: true });
    }
    await interaction.reply({ embeds: [successEmbed(`Cleared **${count}** bounties for this channel.`)] });
  },
};
