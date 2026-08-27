const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');
const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');

async function refreshBoard(client, bounty, guildId, guildName) {
  if (!bounty?.session_id) return;
  try {
    const msgData = await db.getGuildConfig(guildId, `bounty_board_msg_${bounty.session_id}`);
    if (!msgData) return;
    const { channelId, messageId } = JSON.parse(msgData);
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;
    const session = await db.getBountySessionById(bounty.session_id).catch(() => null);
    if (!session) return;
    const bounties = await db.getAllSessionBounties(bounty.session_id).catch(() => []);
    const embed = buildBountyBoardEmbed(session, bounties, guildName);
    await message.edit({ embeds: [embed] });
  } catch (e) {
    console.error('[BountyBoard] Failed to refresh:', e.message);
  }
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('bounty-edit')
      .setDescription('[ADMIN] Edit an existing active bounty')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to edit').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('prize').setDescription('New prize').setRequired(false))
      .addUserOption(o => o.setName('payee').setDescription('New donor/payee').setRequired(false))
      .addUserOption(o => o.setName('target').setDescription('New target player').setRequired(false))
      .addIntegerOption(o => o.setName('death_number').setDescription('New death number').setRequired(false)),

    async autocomplete(interaction) {
      const guildId = interaction.guildId;
      const bounties = await db.getActiveBountiesForGuild(guildId).catch(() => []);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = bounties
        .filter(b => `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(b => ({
          name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize}`,
          value: String(b.id),
        }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      if (bounty.status !== 'active') return interaction.reply({ content: `❌ Only active bounties can be edited.`, ephemeral: true });

      const fields = {};
      const prize = interaction.options.getString('prize');
      const payee = interaction.options.getUser('payee');
      const target = interaction.options.getUser('target');
      const deathNumber = interaction.options.getInteger('death_number');

      if (prize) fields.prize = prize;
      if (payee) { fields.payee_id = payee.id; fields.payee_username = payee.username; }
      if (target) { fields.target_id = target.id; fields.target_username = target.username; }
      if (deathNumber !== null && deathNumber !== undefined) fields.death_number = deathNumber;

      if (!Object.keys(fields).length) {
        return interaction.reply({ content: '❌ Provide at least one field to update.', ephemeral: true });
      }

      await db.editBounty(bountyId, fields);

      // Refresh bounty board
      await refreshBoard(interaction.client, bounty, interaction.guildId, interaction.guild?.name);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty **#${bountyId}** updated. Bounty board refreshed.`)], ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('bounty-remove')
      .setDescription('[ADMIN] Remove a bounty')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to remove').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const guildId = interaction.guildId;
      const bounties = await db.getActiveBountiesForGuild(guildId).catch(() => []);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = bounties
        .filter(b => `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(b => ({
          name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize}`,
          value: String(b.id),
        }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });

      await db.removeBounty(bountyId);

      // Refresh bounty board
      await refreshBoard(interaction.client, bounty, interaction.guildId, interaction.guild?.name);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty **#${bountyId}** removed. Bounty board refreshed.`)], ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('bounty-confirm-paid')
      .setDescription('[ADMIN] Mark a bounty prize as paid out')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to mark as paid').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const guildId = interaction.guildId;
      const bounties = await db.getPendingPayoutBounties(guildId).catch(() => []);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = bounties
        .filter(b => `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(b => ({
          name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize} → ${b.winner_username}`,
          value: String(b.id),
        }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      if (bounty.status !== 'claimed') return interaction.reply({ content: `❌ Bounty #${bountyId} hasn't been claimed yet.`, ephemeral: true });

      await db.markBountyPaid(bountyId);

      // Update payout tracker embed if exists
      const payoutMsgData = await db.getGuildConfig(interaction.guildId, `payout_msg_${bounty.session_id}`).catch(() => null);
      if (payoutMsgData) {
        try {
          const { channelId, messageId } = JSON.parse(payoutMsgData);
          const channel = await interaction.client.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          const session = await db.getBountySessionById(bounty.session_id);
          const allBounties = await db.getAllSessionBounties(bounty.session_id);
          const { buildPayoutTrackerEmbed } = require('../../utils/bountyEmbeds');
          const gameNumber = await db.getGuildConfig(interaction.guildId, `session_game_number_${bounty.session_id}`);
          const embed = buildPayoutTrackerEmbed(session, allBounties, gameNumber);
          await message.edit({ embeds: [embed] });
        } catch (e) {
          console.error('Failed to update payout embed:', e.message);
        }
      }

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`<a:1472186128689008842:1527009614787248238> Bounty **#${bountyId}** marked as paid to **${bounty.winner_username}**!`)], ephemeral: true });
    },
  },
];
