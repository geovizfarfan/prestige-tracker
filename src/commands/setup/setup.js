const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db/database');

async function addChannelToConfig(guildId, key, channelId) {
  const stored = await db.getGuildConfig(guildId, key);
  let channels = [];

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) channels = parsed;
    } catch {
      console.warn(`[Setup] Replacing invalid ${key} configuration for guild ${guildId}`);
    }
  }

  if (!channels.includes(channelId)) channels.push(channelId);
  await db.setGuildConfig(guildId, key, JSON.stringify(channels));
  return channels;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Orbit Tracker for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('game-channel')
        .setDescription('Register this channel for automatic game tracking')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'game-channel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await Promise.all([
        addChannelToConfig(interaction.guildId, 'hangry_channels', interaction.channelId),
        addChannelToConfig(interaction.guildId, 'rumble_royale_channels', interaction.channelId),
      ]);

      await interaction.editReply(
        `✅ <#${interaction.channelId}> is now registered for **Hangry Games** and **Rumble Royale** tracking.`
      );
    }
  },
};
