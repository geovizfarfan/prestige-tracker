const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed } = require('../../utils/embeds');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('set-bounty-review-channel')
      .setDescription('[ADMIN] Set the channel where new bounties go for approval')
      .addChannelOption(o => o.setName('channel').setDescription('Review channel').setRequired(true)),
    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const channel = interaction.options.getChannel('channel');
      await db.setConfig('review_channel', channel.id);
      await interaction.reply({ embeds: [successEmbed(`Bounty review channel set to <#${channel.id}>`)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('set-claim-channel')
      .setDescription('[ADMIN] Set the channel members use to claim bounty prizes')
      .addChannelOption(o => o.setName('channel').setDescription('Claim/ticket channel').setRequired(true)),
    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const channel = interaction.options.getChannel('channel');
      await db.setConfig('claim_channel', channel.id);
      await interaction.reply({ embeds: [successEmbed(`Bounty claim channel set to <#${channel.id}>`)] });
    },
  },
];
