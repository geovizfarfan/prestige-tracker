const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounty-setup')
    .setDescription('[ADMIN] Configure bounty system settings for this server')
    .addStringOption(o => o.setName('setting').setDescription('What to configure').setRequired(true).addChoices(
      { name: 'Bounty review channel', value: 'bounty_review_channel' },
      { name: 'Bounty results channel', value: 'bounty_results_channel' },
      { name: 'Claim ticket channel', value: 'claim_channel' },
      { name: 'Hangry Games channel', value: 'hangry_channel' },
      { name: 'Hangry results channel', value: 'hangry_results_channel' },
    ))
    .addChannelOption(o => o.setName('channel').setDescription('The channel to set').setRequired(true)),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const setting = interaction.options.getString('setting');
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    // For hangry channel, store as array to support multiple channels
    if (setting === 'hangry_channel') {
      const existing = await db.getGuildConfig(guildId, 'hangry_channels');
      let channels = existing ? JSON.parse(existing) : [];
      if (!channels.includes(channel.id)) channels.push(channel.id);
      await db.setGuildConfig(guildId, 'hangry_channels', JSON.stringify(channels));
    } else {
      await db.setGuildConfig(guildId, setting, channel.id);
    }

    const labels = {
      bounty_review_channel: 'Bounty review channel',
      bounty_results_channel: 'Bounty results channel',
      claim_channel: 'Claim ticket channel',
      hangry_channel: 'Hangry Games tracking channel',
      hangry_results_channel: 'Hangry Games results channel',
    };

    const embed = new EmbedBuilder()
      .setColor(LAVENDER)
      .setDescription(`${E.sparkle} **${labels[setting]}** set to <#${channel.id}>`);

    await interaction.reply({ embeds: [embed] });
  },
};
