// src/commands/bounties/bounty.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E, buildBountyListEmbed, buildPayoutTrackerEmbed } = require('../../utils/bountyEmbeds');
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

async function sessionAutocomplete(interaction) {
  const sessions = await db.getActiveBountySessions(interaction.guildId).catch(() => []);
  const focused = interaction.options.getFocused().toLowerCase();
  const filtered = sessions
    .filter(s => s.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(s => ({ name: `#${s.id} — ${s.name}`, value: String(s.id) }));
  await interaction.respond(filtered);
}

async function activeBountyAutocomplete(interaction) {
  const bounties = await db.getActiveBountiesForGuild(interaction.guildId).catch(() => []);
  const focused = interaction.options.getFocused().toLowerCase();
  const filtered = bounties
    .filter(b => `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(b => ({ name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize}`, value: String(b.id) }));
  await interaction.respond(filtered);
}

async function pendingPayoutAutocomplete(interaction) {
  const bounties = await db.getPendingPayoutBounties(interaction.guildId).catch(() => []);
  const focused = interaction.options.getFocused().toLowerCase();
  const filtered = bounties
    .filter(b => `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(b => ({ name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize} → ${b.winner_username}`, value: String(b.id) }));
  await interaction.respond(filtered);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounty')
    .setDescription('Manage bounties')

    .addSubcommand(s => s.setName('list').setDescription('Show active bounties for a specific game session')
      .addStringOption(o => o.setName('session').setDescription('Which game to view bounties for').setRequired(true).setAutocomplete(true)))

    .addSubcommand(s => s.setName('edit').setDescription('[ADMIN] Edit an existing active bounty')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to edit').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('prize').setDescription('New prize').setRequired(false))
      .addUserOption(o => o.setName('payee').setDescription('New donor/payee').setRequired(false))
      .addUserOption(o => o.setName('target').setDescription('New target player').setRequired(false))
      .addIntegerOption(o => o.setName('death_number').setDescription('New death number').setRequired(false)))

    .addSubcommand(s => s.setName('remove').setDescription('[ADMIN] Remove a bounty')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to remove').setRequired(true).setAutocomplete(true)))

    .addSubcommand(s => s.setName('confirm-paid').setDescription('[ADMIN] Mark a bounty prize as paid out')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to mark as paid').setRequired(true).setAutocomplete(true)))

    .addSubcommand(s => s.setName('repost').setDescription('[ADMIN] Repost the bounty board (use if the embed was deleted)')
      .addStringOption(o => o.setName('session').setDescription('Which bounty session').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (defaults to configured bounty channel)').setRequired(false))),

  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list' || sub === 'repost') return sessionAutocomplete(interaction);
    if (sub === 'edit' || sub === 'remove') return activeBountyAutocomplete(interaction);
    if (sub === 'confirm-paid') return pendingPayoutAutocomplete(interaction);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'list') {
      const sessionId = parseInt(interaction.options.getString('session'));
      const session = await db.getBountySessionById(sessionId);
      if (!session) return interaction.reply({ content: '❌ Game session not found.', ephemeral: true });
      const bounties = await db.getBounties(sessionId);
      const claimChannelId = await db.getGuildConfig(guildId, 'claim_channel');
      const { embed, totalPages } = buildBountyListEmbed(session, bounties, 0, claimChannelId);
      const userId = interaction.user.id;
      const row = totalPages > 1 ? new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bl_${sessionId}_0_prev_${userId}`).setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`bl_info`).setLabel(`1 / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`bl_${sessionId}_1_next_${userId}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary),
      ) : null;
      return interaction.reply({ embeds: [embed], components: row ? [row] : [] });
    }

    if (sub === 'edit') {
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
      if (!Object.keys(fields).length) return interaction.reply({ content: '❌ Provide at least one field to update.', ephemeral: true });

      await db.editBounty(bountyId, fields);
      await refreshBoard(interaction.client, bounty, guildId, interaction.guild?.name);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty **#${bountyId}** updated. Bounty board refreshed.`)], ephemeral: true });
    }

    if (sub === 'remove') {
      if (!await requireAdmin(interaction)) return;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      await db.removeBounty(bountyId);
      await refreshBoard(interaction.client, bounty, guildId, interaction.guild?.name);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty **#${bountyId}** removed. Bounty board refreshed.`)], ephemeral: true });
    }

    if (sub === 'confirm-paid') {
      if (!await requireAdmin(interaction)) return;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      if (bounty.status !== 'claimed') return interaction.reply({ content: `❌ Bounty #${bountyId} hasn't been claimed yet.`, ephemeral: true });
      await db.markBountyPaid(bountyId);
      const payoutMsgData = await db.getGuildConfig(guildId, `payout_msg_${bounty.session_id}`).catch(() => null);
      if (payoutMsgData) {
        try {
          const { channelId, messageId } = JSON.parse(payoutMsgData);
          const channel = await interaction.client.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          const session = await db.getBountySessionById(bounty.session_id);
          const allBounties = await db.getAllSessionBounties(bounty.session_id);
          const gameNumber = await db.getGuildConfig(guildId, `session_game_number_${bounty.session_id}`);
          const embed = buildPayoutTrackerEmbed(session, allBounties, gameNumber);
          await message.edit({ embeds: [embed] });
        } catch (e) {
          console.error('Failed to update payout embed:', e.message);
        }
      }
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`<a:1472186128689008842:1527009614787248238> Bounty **#${bountyId}** marked as paid to **${bounty.winner_username}**!`)], ephemeral: true });
    }

    if (sub === 'repost') {
      if (!await requireAdmin(interaction)) return;
      const sessionId = parseInt(interaction.options.getString('session'));
      const channelOverride = interaction.options.getChannel('channel');
      const session = await db.getBountySessionById(sessionId).catch(() => null);
      if (!session) return interaction.reply({ content: '❌ Session not found.', ephemeral: true });
      const bounties = await db.getAllSessionBounties(sessionId).catch(() => []);
      const boardEmbed = buildBountyBoardEmbed(session, bounties, interaction.guild?.name);
      const targetChannelId = channelOverride?.id || session.bounty_channel_id || await db.getGuildConfig(guildId, 'bounty_results_channel');
      if (!targetChannelId) return interaction.reply({ content: '❌ No bounty channel configured. Specify a channel.', ephemeral: true });
      const targetChannel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
      if (!targetChannel) return interaction.reply({ content: '❌ Could not find that channel.', ephemeral: true });
      const msg = await targetChannel.send({ embeds: [boardEmbed] });
      await db.setGuildConfig(guildId, `bounty_board_msg_${sessionId}`, JSON.stringify({ channelId: targetChannelId, messageId: msg.id }));
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty board reposted in <#${targetChannelId}>`)], ephemeral: true });
    }
  },
};
