const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db/database');
const { buildReviewEmbed, LAVENDER, E } = require('../../utils/bountyEmbeds');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addbounty')
    .setDescription('Submit a bounty for an active game session (requires staff approval)')
    .addStringOption(o => o.setName('session').setDescription('Which game to place this bounty on').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('type').setDescription('Bounty type').setRequired(true).addChoices(
      { name: 'Kill — prize for killing a player', value: 'kill' },
      { name: 'Avenge — prize for avenging a player', value: 'avenge' },
      { name: 'Death — prize for causing the Nth death (kills + suicides)', value: 'death' },
      { name: 'Suicide — prize for the Nth suicide specifically', value: 'suicide' },
      { name: 'Winner — prize for winning the match', value: 'winner' },
    ))
    .addStringOption(o => o.setName('prize').setDescription('What the winner receives').setRequired(true))
    .addUserOption(o => o.setName('payee').setDescription('Who pays out the prize').setRequired(true))
    .addUserOption(o => o.setName('target').setDescription('Target player (required for Kill/Avenge)').setRequired(false))
    .addIntegerOption(o => o.setName('death_number').setDescription('Which death/suicide number (required for Death/Suicide)').setRequired(false)),

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    const sessions = await db.getActiveBountySessions(guildId);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = sessions
      .filter(s => s.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(s => ({ name: `#${s.id} — ${s.name}`, value: String(s.id) }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId;
    const sessionId = parseInt(interaction.options.getString('session'));
    const type = interaction.options.getString('type');
    const prize = interaction.options.getString('prize');
    const payee = interaction.options.getUser('payee');
    const target = interaction.options.getUser('target');
    const deathNumber = interaction.options.getInteger('death_number');

    const session = await db.getBountySessionById(sessionId);
    if (!session || session.status !== 'active') {
      return interaction.editReply({ content: '❌ That game session is no longer active.', ephemeral: true });
    }

    if ((type === 'kill' || type === 'avenge') && !target) {
      return interaction.editReply({ content: `❌ You must specify a \`target\` for ${type} bounties.`, ephemeral: true });
    }
    if ((type === 'death' || type === 'suicide') && !deathNumber) {
      return interaction.editReply({ content: `❌ You must specify \`death_number\` for ${type} bounties.`, ephemeral: true });
    }

    const bounty = await db.addBounty({
      guild_id: guildId,
      session_id: session.id,
      channel_id: session.game_channel_id,
      type, prize,
      payee_id: payee.id, payee_username: payee.username,
      target_id: target?.id || null, target_username: target?.username || null,
      death_number: deathNumber || null,
      set_by_id: interaction.user.id, set_by_username: interaction.user.username,
      game_link: session.game_link || null,
    });
    // Admin/score role bypass - skip review
    const { isAdmin } = require('../../utils/permissions');
    const permRoles = await db.getPermRoles('score').catch(() => []);
    const memberRoleIds = interaction.member?.roles?.cache ? [...interaction.member.roles.cache.keys()] : [];
    const hasPermRole = permRoles.some(id => memberRoleIds.includes(id));
    const canBypass = isAdmin(interaction) || hasPermRole;

    if (canBypass) {
      await db.approveBounty(bounty.id, interaction.user.id, interaction.user.username);
      // Refresh bounty board
      try {
        const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');
        const boardData = await db.getGuildConfig(guildId, `bounty_board_msg_${session.id}`).catch(() => null);
        if (boardData) {
          const { channelId: bChId, messageId: bMsgId } = JSON.parse(boardData);
          const bCh = await interaction.client.channels.fetch(bChId).catch(() => null);
          const bMsg = bCh ? await bCh.messages.fetch(bMsgId).catch(() => null) : null;
          if (bMsg) {
            const allBounties = await db.getAllSessionBounties(session.id).catch(() => []);
            await bMsg.edit({ embeds: [buildBountyBoardEmbed(session, allBounties, interaction.guild?.name)] });
          }
        }
      } catch(e) { console.error('[bypass board]', e.message); }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty **#${bounty.id}** is now live!`)], ephemeral: true });
    }


    // Send to review channel
    const reviewChannelId = await db.getGuildConfig(guildId, 'bounty_review_channel');
    if (reviewChannelId) {
      try {
        const reviewChannel = await interaction.client.channels.fetch(reviewChannelId);
        const { embed, row } = buildReviewEmbed(bounty, session);
        await reviewChannel.send({ embeds: [embed], components: [row] });
      } catch (e) {
        console.error('Failed to send to review channel:', e.message);
      }
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(LAVENDER)
      .setDescription(`${E.sparkle} Bounty **#${bounty.id}** submitted! Staff will review it shortly.` +
        (!reviewChannelId ? '\n⚠️ No review channel set — ask an admin to run `/bounty-setup`' : ''));

    await interaction.editReply({ embeds: [confirmEmbed], ephemeral: true });
  },
};
