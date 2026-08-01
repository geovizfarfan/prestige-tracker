const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const db = require('../../db/database');

const GAME_CONFIG = {
  'hunger-games': {
    label: 'Hunger Games',
    key: 'hangry_channels',
  },
  'rumble-royale': {
    label: 'Rumble Royale',
    key: 'rumble_royale_channels',
  },
  'rumble-slaughter': {
    label: 'Rumble Slaughter',
    key: 'rumble_slaughter_channels',
  },
  'regret-games': {
    label: 'Regret Games',
    key: 'regret_games_channels',
  },
};

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
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Orbit Tracker for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('game-channel')
        .setDescription('Choose which game channel Orbit Tracker should monitor')
        .addStringOption(option =>
          option
            .setName('game')
            .setDescription('Game to track in this channel')
            .setRequired(true)
            .addChoices(
              { name: 'Hunger Games', value: 'hunger-games' },
              { name: 'Rumble Royale', value: 'rumble-royale' },
              { name: 'Rumble Slaughter', value: 'rumble-slaughter' },
              { name: 'Regret Games', value: 'regret-games' },
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel where the selected game is played')
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() !== 'game-channel') return;

    const game = interaction.options.getString('game', true);
    const channel = interaction.options.getChannel('channel', true);
    const config = GAME_CONFIG[game];

    if (!config) {
      await interaction.reply({
        content: '❌ That game is not supported.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await addChannelToConfig(interaction.guildId, config.key, channel.id);

    await interaction.editReply(
      `✅ <#${channel.id}> is now registered for **${config.label}** tracking.`
    );
  },
};
