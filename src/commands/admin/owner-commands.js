const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { requireOwner } = require('../../utils/permissions');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
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
};
