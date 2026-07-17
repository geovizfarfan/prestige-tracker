const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('bounty-session-start')
      .setDescription('[ADMIN] Start a new bounty session tied to a game')
      .addStringOption(o => o.setName('name').setDescription('Game session name (e.g. "Hangry Games Round 14")').setRequired(true))
      .addChannelOption(o => o.setName('game_channel').setDescription('Channel where the game is happening').setRequired(true))
      .addStringOption(o => o.setName('game_link').setDescription('Link to the tribute list / join message (required)').setRequired(true))
      .addChannelOption(o => o.setName('bounty_channel').setDescription('Channel to post bounty results (optional)').setRequired(false)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const name = interaction.options.getString('name');
      const gameChannel = interaction.options.getChannel('game_channel');
      const gameLink = interaction.options.getString('game_link');
      const bountyChannel = interaction.options.getChannel('bounty_channel');

      if (!gameLink.startsWith('https://discord.com/channels/')) {
        return interaction.reply({ content: '❌ `game_link` must be a valid Discord message link.', ephemeral: true });
      }

      const session = await db.createBountySession({
        guild_id: interaction.guildId,
        name, game_channel_id: gameChannel.id,
        bounty_channel_id: bountyChannel?.id || null,
        game_link: gameLink,
        created_by_id: interaction.user.id,
        created_by_username: interaction.user.username,
      });

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Bounty Session Started!`)
        .setDescription(
          `**"${name}"** is now open for bounties!\n` +
          `🎮 Game channel: <#${gameChannel.id}>\n` +
          `🔗 [Jump to game](${gameLink})\n` +
          (bountyChannel ? `🎯 Results channel: <#${bountyChannel.id}>\n` : '') +
          `\nSession ID: \`#${session.id}\` — Members can now use \`/addbounty\``
        )
        .setFooter({ text: 'Prestige Tracker • Bounty System' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('bounty-session-end')
      .setDescription('[ADMIN] End an active bounty session')
      .addStringOption(o => o.setName('session').setDescription('Session to end').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
      const sessions = await db.getActiveBountySessions(interaction.guildId);
      const focused = interaction.options.getFocused().toLowerCase();
      const filtered = sessions.filter(s => s.name.toLowerCase().includes(focused)).slice(0, 25)
        .map(s => ({ name: `#${s.id} — ${s.name}`, value: String(s.id) }));
      await interaction.respond(filtered);
    },

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const id = parseInt(interaction.options.getString('session'));
      const session = await db.getBountySessionById(id);
      if (!session) return interaction.reply({ content: `❌ Session #${id} not found.`, ephemeral: true });
      await db.endBountySession(id);
      const embed = new EmbedBuilder().setColor(LAVENDER)
        .setDescription(`${E.sparkle} Bounty session **"${session.name}"** has ended.`);
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('bounty-sessions')
      .setDescription('List all active bounty sessions'),

    async execute(interaction) {
      const sessions = await db.getActiveBountySessions(interaction.guildId);
      if (!sessions.length) return interaction.reply({ content: '❌ No active bounty sessions.', ephemeral: true });
      const lines = sessions.map(s =>
        `**#${s.id} — ${s.name}**\n> 🎮 <#${s.game_channel_id}>` +
        (s.game_link ? `  [Jump to game](${s.game_link})` : '')
      ).join('\n\n');
      const embed = new EmbedBuilder().setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Active Bounty Sessions`)
        .setDescription(lines).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    },
  },
];
