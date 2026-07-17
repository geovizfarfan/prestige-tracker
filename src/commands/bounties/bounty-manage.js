const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E, buildPayoutTrackerEmbed } = require('../../utils/bountyEmbeds');

module.exports = [
  // ─── bounty-confirm-paid (autocomplete dropdown) ─────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('bounty-confirm-paid')
      .setDescription('[ADMIN] Mark a bounty prize as paid out')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to mark as paid').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const guildId = interaction.guildId;
      // Get all claimed (awaiting payout) bounties for this guild
      const bounties = await db.getPendingPayoutBounties(guildId);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = bounties
        .filter(b => {
          const label = `#${b.id} ${b.type} ${b.target_username || ''}`.toLowerCase();
          return label.includes(focused);
        })
        .slice(0, 25)
        .map(b => ({
          name: `#${b.id} — ${b.type.toUpperCase()} ${b.target_username ? `→ ${b.target_username}` : ''} | ${b.prize} → ${b.winner_username}`,
          value: String(b.id),
        }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const guildId = interaction.guildId;
      const bountyId = parseInt(interaction.options.getString('bounty'));
      const bounty = await db.getBountyById(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      if (bounty.status !== 'claimed') return interaction.reply({ content: `❌ Bounty #${bountyId} is not awaiting payout.`, ephemeral: true });

      await db.markBountyPaid(bountyId);

      // Update payout tracker embed
      const payoutMsgData = await db.getGuildConfig(guildId, `payout_msg_${bounty.session_id}`);
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

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.paid} Bounty **#${bountyId}** marked as paid to **${bounty.winner_username}**!`);
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── bounty-edit ─────────────────────────────────────────────────────────
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
      const bounties = await db.getActiveBountiesForGuild(guildId);
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
      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Bounty **#${bountyId}** updated.`);
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── bounty-remove ───────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('bounty-remove')
      .setDescription('[ADMIN] Remove a bounty')
      .addStringOption(o => o.setName('bounty').setDescription('Select the bounty to remove').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const guildId = interaction.guildId;
      const bounties = await db.getActiveBountiesForGuild(guildId);
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
      const bounty = await db.removeBounty(bountyId);
      if (!bounty) return interaction.reply({ content: `❌ Bounty #${bountyId} not found.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Bounty **#${bountyId}** removed.`);
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── bounty-payouts ──────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('bounty-payouts')
      .setDescription('View payout tracker for a game session')
      .addStringOption(o => o.setName('session').setDescription('Game session').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const sessions = await db.getAllBountySessions(interaction.guildId);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = sessions
        .filter(s => s.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(s => ({ name: `#${s.id} — ${s.name} (${s.status})`, value: String(s.id) }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      const guildId = interaction.guildId;
      const sessionId = parseInt(interaction.options.getString('session'));
      const session = await db.getBountySessionById(sessionId);
      if (!session) return interaction.reply({ content: '❌ Session not found.', ephemeral: true });
      const bounties = await db.getAllSessionBounties(sessionId);
      const gameNumber = await db.getGuildConfig(guildId, `session_game_number_${sessionId}`);
      const embed = buildPayoutTrackerEmbed(session, bounties, gameNumber);
      await interaction.reply({ embeds: [embed] });
    },
  },
];
