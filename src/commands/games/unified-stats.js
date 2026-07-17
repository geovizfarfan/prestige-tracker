const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');
const { getUnifiedStats, getUnifiedPlayerStats } = require('../../games/unifiedGameTracker');

const GAME_LABELS = {
  hangrygames: 'Hangry Games',
  rumbleroyale: 'Rumble Royale',
  rumbleslaughter: 'Rumble Slaughter',
  regretgames: 'Regret Games',
  all: 'All Games',
};

const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('game-leaderboard')
      .setDescription('Show win/kill leaderboard for any tracked game')
      .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true).addChoices(
        { name: 'All Games', value: 'all' },
        { name: 'Hangry Games', value: 'hangrygames' },
        { name: 'Rumble Royale', value: 'rumbleroyale' },
        { name: 'Rumble Slaughter', value: 'rumbleslaughter' },
        { name: 'Regret Games', value: 'regretgames' },
      ))
      .addStringOption(o => o.setName('type').setDescription('Stat type').setRequired(false).addChoices(
        { name: 'Wins', value: 'wins' },
        { name: 'Kills', value: 'kills' },
        { name: 'Suicides', value: 'suicides' },
      )),

    async execute(interaction) {
      await interaction.deferReply();
      const game = interaction.options.getString('game');
      const type = interaction.options.getString('type') || 'wins';
      const guildId = interaction.guildId;

      const stats = await getUnifiedStats(guildId, game, 15);
      const data = stats[type] || [];

      if (!data.length) return interaction.editReply({ content: `❌ No ${type} tracked yet for **${GAME_LABELS[game]}**.` });

      const nameKey = type === 'wins' ? 'winner_username' : type === 'kills' ? 'killer' : 'victim';
      const countKey = type === 'wins' ? 'wins' : type === 'kills' ? 'kills' : 'suicides';

      const lines = data.map((row, i) => {
        const medal = RANK_MEDALS[i] || '<a:completed:1490144466668097668>';
        const name = row.winner_id ? `<@${row.winner_id}>` : `**${row[nameKey]}**`;
        return `${medal}  ${name} — \`${row[countKey]}\``;
      }).join('\n');

      const titles = { wins: 'Most Wins', kills: 'Most Kills', suicides: 'Most Suicides' };

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  ${GAME_LABELS[game]} — ${titles[type]}`)
        .setDescription(lines)
        .setFooter({ text: 'Prestige Tracker • Game Leaderboard' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('player-stats')
      .setDescription('Show a player\'s stats across ALL tracked games')
      .addUserOption(o => o.setName('user').setDescription('Player to look up').setRequired(true)),

    async execute(interaction) {
      await interaction.deferReply();
      const target = interaction.options.getUser('user');
      const guildId = interaction.guildId;
      const stats = await getUnifiedPlayerStats(target.id, target.username, guildId);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  ${target.username} — All Game Stats`)
        .setDescription(`**Total wins across all games: \`${stats.totalWins}\`**`)
        .addFields(
          {
            name: 'Hangry Games',
            value: `Wins: \`${stats.hangrygames.wins}\`  Kills: \`${stats.hangrygames.kills}\`  Deaths: \`${stats.hangrygames.deaths}\``,
            inline: false,
          },
          {
            name: 'Rumble Royale',
            value: `Wins: \`${stats.rumbleroyale.wins}\`  Kills: \`${stats.rumbleroyale.kills}\`  Deaths: \`${stats.rumbleroyale.deaths}\``,
            inline: false,
          },
          {
            name: 'Rumble Slaughter',
            value: `Wins: \`${stats.rumbleslaughter.wins}\`  Kills: \`${stats.rumbleslaughter.kills}\`  Deaths: \`${stats.rumbleslaughter.deaths}\``,
            inline: false,
          },
          {
            name: 'Regret Games',
            value: `Wins: \`${stats.regretgames.wins}\`  Kills: \`${stats.regretgames.kills}\`  Deaths: \`${stats.regretgames.deaths}\``,
            inline: false,
          },
        )
        .setFooter({ text: 'Prestige Tracker • Player Stats' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('set-game-channel')
      .setDescription('[ADMIN] Register a channel to track a specific game')
      .addStringOption(o => o.setName('game').setDescription('Which game to track').setRequired(true).addChoices(
        { name: 'Hangry Games (PixxieBot)', value: 'hangry' },
        { name: 'Rumble Royale', value: 'rumbleroyale' },
        { name: 'Rumble Slaughter (Play & Regret)', value: 'rumbleslaughter' },
        { name: 'Regret Games (Play & Regret)', value: 'regretgames' },
      ))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to watch').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(false).addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
      )),

    async execute(interaction) {
      const { requireAdmin } = require('../../utils/permissions');
      if (!await requireAdmin(interaction)) return;

      const game = interaction.options.getString('game');
      const channel = interaction.options.getChannel('channel');
      const action = interaction.options.getString('action') || 'add';
      const guildId = interaction.guildId;

      const configKey = {
        hangry: 'hangry_channels',
        rumbleroyale: 'rumble_royale_channels',
        rumbleslaughter: 'rumble_slaughter_channels',
        regretgames: 'regret_games_channels',
      }[game];

      const existing = await db.getGuildConfig(guildId, configKey);
      let channels = existing ? JSON.parse(existing) : [];

      if (action === 'add') {
        if (!channels.includes(channel.id)) channels.push(channel.id);
        await db.setGuildConfig(guildId, configKey, JSON.stringify(channels));
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Now tracking **${GAME_LABELS[game] || game}** in <#${channel.id}>`)] });
      } else {
        channels = channels.filter(id => id !== channel.id);
        await db.setGuildConfig(guildId, configKey, JSON.stringify(channels));
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Stopped tracking **${GAME_LABELS[game] || game}** in <#${channel.id}>`)] });
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('set-win-points')
      .setDescription('[ADMIN] Set team points awarded per game win')
      .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true).addChoices(
        { name: 'Hangry Games', value: 'hangrygames' },
        { name: 'Rumble Royale', value: 'rumbleroyale' },
        { name: 'Rumble Slaughter', value: 'rumbleslaughter' },
        { name: 'Regret Games', value: 'regretgames' },
      ))
      .addIntegerOption(o => o.setName('points').setDescription('Points per win (0 to disable)').setMinValue(0).setMaxValue(100).setRequired(true))
      .addChannelOption(o => o.setName('notify_channel').setDescription('Channel to announce point awards').setRequired(false)),

    async execute(interaction) {
      const { requireAdmin } = require('../../utils/permissions');
      if (!await requireAdmin(interaction)) return;
      const game = interaction.options.getString('game');
      const points = interaction.options.getInteger('points');
      const notifyChannel = interaction.options.getChannel('notify_channel');
      const guildId = interaction.guildId;

      await db.setGuildConfig(guildId, `${game}_win_points`, String(points));
      if (notifyChannel) await db.setGuildConfig(guildId, 'game_points_channel', notifyChannel.id);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} **${GAME_LABELS[game]}** wins now award **${points} team points**${notifyChannel ? ` — posted in <#${notifyChannel.id}>` : ''}.`)] });
    },
  },
];
