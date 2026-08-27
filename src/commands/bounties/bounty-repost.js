const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounty-repost')
    .setDescription('[ADMIN] Repost the bounty board (use if the embed was deleted)')
    .addStringOption(o => o.setName('session').setDescription('Which bounty session').setRequired(true).setAutocomplete(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (defaults to configured bounty channel)').setRequired(false)),

  async autocomplete(interaction) {
    const sessions = await db.getActiveBountySessions(interaction.guildId).catch(() => []);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = sessions
      .filter(s => s.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(s => ({ name: `#${s.id} — ${s.name}`, value: String(s.id) }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const guildId = interaction.guildId;
    const sessionId = parseInt(interaction.options.getString('session'));
    const channelOverride = interaction.options.getChannel('channel');

    const session = await db.getBountySessionById(sessionId).catch(() => null);
    if (!session) return interaction.reply({ content: '❌ Session not found.', ephemeral: true });

    const bounties = await db.getAllSessionBounties(sessionId).catch(() => []);
    const boardEmbed = buildBountyBoardEmbed(session, bounties, interaction.guild?.name);

    // Determine which channel to post in
    const targetChannelId = channelOverride?.id || session.bounty_channel_id || await db.getGuildConfig(guildId, 'bounty_results_channel');
    if (!targetChannelId) return interaction.reply({ content: '❌ No bounty channel configured. Specify a channel.', ephemeral: true });

    const targetChannel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) return interaction.reply({ content: '❌ Could not find that channel.', ephemeral: true });

    const msg = await targetChannel.send({ embeds: [boardEmbed] });

    // Update stored message ID
    await db.setGuildConfig(guildId, `bounty_board_msg_${sessionId}`, JSON.stringify({
      channelId: targetChannelId,
      messageId: msg.id,
    }));

    await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Bounty board reposted in <#${targetChannelId}>`)], ephemeral: true });
  },
};
