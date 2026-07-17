const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('bounty-remove')
      .setDescription('[ADMIN] Remove a bounty')
      .addIntegerOption(o => o.setName('id').setDescription('Bounty ID (shown in /bounties)').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const id = interaction.options.getInteger('id');
      const bounty = await db.removeBounty(id);
      if (!bounty) return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} not found.`)], ephemeral: true });
      await interaction.reply({ embeds: [successEmbed(`Bounty **#${id}** removed.`)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('bounty-edit')
      .setDescription('[ADMIN] Edit an existing bounty')
      .addIntegerOption(o => o.setName('id').setDescription('Bounty ID (shown in /bounties)').setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('New prize').setRequired(false))
      .addUserOption(o => o.setName('payee').setDescription('New donor/payee').setRequired(false))
      .addUserOption(o => o.setName('target').setDescription('New target player').setRequired(false))
      .addIntegerOption(o => o.setName('deathnumber').setDescription('New death number').setRequired(false)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const id = interaction.options.getInteger('id');
      const bounty = await db.getBountyById(id);
      if (!bounty) return interaction.reply({ embeds: [errorEmbed(`Bounty #${id} not found.`)], ephemeral: true });

      const fields = {};
      const prize = interaction.options.getString('prize');
      const payee = interaction.options.getUser('payee');
      const target = interaction.options.getUser('target');
      const deathNumber = interaction.options.getInteger('deathnumber');

      if (prize) fields.prize = prize;
      if (payee) { fields.payee_id = payee.id; fields.payee_username = payee.username; }
      if (target) { fields.target_id = target.id; fields.target_username = target.username; }
      if (deathNumber !== null && deathNumber !== undefined) fields.death_number = deathNumber;

      if (!Object.keys(fields).length) {
        return interaction.reply({ embeds: [errorEmbed('You must provide at least one field to update.')], ephemeral: true });
      }

      const updated = await db.editBounty(id, fields);
      await interaction.reply({ embeds: [successEmbed(`Bounty **#${id}** updated.\n**Prize:** ${updated.prize}\n**Donor:** ${updated.payee_username}`)] });
    },
  },
];
