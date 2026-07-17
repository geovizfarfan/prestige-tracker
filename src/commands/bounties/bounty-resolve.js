const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('bounty-resolve')
      .setDescription('[ADMIN] Mark a bounty as claimed by a winner')
      .addIntegerOption(o => o.setName('id').setDescription('Bounty ID (shown in /bounties)').setRequired(true))
      .addUserOption(o => o.setName('winner').setDescription('Who claimed the bounty').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const id = interaction.options.getInteger('id');
      const winner = interaction.options.getUser('winner');

      const bounty = await db.getBountyById(id);
      if (!bounty) return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} not found.`)], ephemeral: true });
      if (bounty.status !== 'active') return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} is not active (status: ${bounty.status}).`)], ephemeral: true });

      await db.resolveBounty(id, winner.id, winner.username);

      const claimChannelId = await db.getConfig('claim_channel');
      const claimText = claimChannelId ? `\n\n💳 ${winner.username}, open a ticket in <#${claimChannelId}> to claim your prize!` : '';

      await interaction.reply({ embeds: [successEmbed(
        `**#${id}** claimed by **${winner.username}**!\n` +
        `🎁 Prize: ${bounty.prize}  ·  💰 From: ${bounty.payee_username}${claimText}`
      )] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('bounty-confirm-paid')
      .setDescription('[ADMIN] Confirm a bounty prize has been paid out')
      .addIntegerOption(o => o.setName('id').setDescription('Bounty ID').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const id = interaction.options.getInteger('id');
      const bounty = await db.getBountyById(id);
      if (!bounty) return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} not found.`)], ephemeral: true });
      if (bounty.status !== 'claimed') return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} hasn't been claimed yet. Use /bounty-resolve first.`)], ephemeral: true });

      await db.markBountyPaid(id);
      await interaction.reply({ embeds: [successEmbed(`Bounty **#${id}** marked as **paid** to ${bounty.winner_username}. 🎉`)] });
    },
  },
];
