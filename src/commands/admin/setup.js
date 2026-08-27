const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

const GAME_TYPES = [
  { name: 'Hangry Games (PixxieBot)', value: 'hangry' },
  { name: 'Rumble Royale', value: 'rumbleroyale' },
  { name: 'Rumble Slaughter (Play & Regret)', value: 'rumbleslaughter' },
  { name: 'Regret Games (Play & Regret)', value: 'regretgames' },
];

const CONFIG_KEYS = {
  'hangry': 'hangry_channels',
  'rumbleroyale': 'rumble_royale_channels',
  'rumbleslaughter': 'rumble_slaughter_channels',
  'regretgames': 'regret_games_channels',
};

const GAME_LABELS = {
  hangry: 'Hangry Games', rumbleroyale: 'Rumble Royale',
  rumbleslaughter: 'Rumble Slaughter', regretgames: 'Regret Games',
  hangrygames: 'Hangry Games',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('[ADMIN] Configure Prestige Tracker settings')

    // ── Bounty channels ───────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('bounty-review').setDescription('Set the channel where new bounties go for staff approval')
      .addChannelOption(o => o.setName('channel').setDescription('Review channel').setRequired(true)))
    .addSubcommand(s => s.setName('bounty-results').setDescription('Set the channel where bounty resolutions and game recaps are posted')
      .addChannelOption(o => o.setName('channel').setDescription('Results channel').setRequired(true)))
    .addSubcommand(s => s.setName('claim-channel').setDescription('Set the channel members use to claim bounty prizes')
      .addChannelOption(o => o.setName('channel').setDescription('Claim/ticket channel').setRequired(true)))
    .addSubcommand(s => s.setName('points-channel').setDescription('Set the channel where team point awards are announced')
      .addChannelOption(o => o.setName('channel').setDescription('Points announcement channel').setRequired(true)))

    // ── Game channels ─────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('game-channel').setDescription('Register or remove a channel for tracking a specific game')
      .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true).addChoices(...GAME_TYPES))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to watch').setRequired(true))
      .addStringOption(o => o.setName('action').setDescription('Add or remove (default: add)').setRequired(false).addChoices(
        { name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' },
      )))
    .addSubcommand(s => s.setName('game-results').setDescription('Set the channel where game results are posted')
      .addChannelOption(o => o.setName('channel').setDescription('Results channel').setRequired(true)))

    // ── Win points ────────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('win-points').setDescription('Set how many team points a game win awards')
      .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true).addChoices(
        { name: 'Hangry Games', value: 'hangrygames' },
        { name: 'Rumble Royale', value: 'rumbleroyale' },
        { name: 'Rumble Slaughter', value: 'rumbleslaughter' },
        { name: 'Regret Games', value: 'regretgames' },
      ))
      .addIntegerOption(o => o.setName('points').setDescription('Points per win (0 to disable)').setMinValue(0).setMaxValue(100).setRequired(true)))

    // ── Score role ────────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('score-role').setDescription('Add or remove a role that can add/remove points')
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices(
        { name: 'Add role', value: 'add' }, { name: 'Remove role', value: 'remove' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('The role').setRequired(true)))

    // ── Season dates ──────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('season-start').setDescription('Set the start date for the current team session')
      .addStringOption(o => o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true)))
    .addSubcommand(s => s.setName('season-end').setDescription('Set the end date for the current team session')
      .addStringOption(o => o.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true)))

    // ── Scoreboard ────────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('scoreboard').setDescription('Post the live scoreboard in this channel'))

    // ── View all ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s.setName('view').setDescription('View all current Prestige Tracker settings')),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── Channel settings ───────────────────────────────────────────────────────
    const channelSubcommands = {
      'bounty-review': 'bounty_review_channel',
      'bounty-results': 'bounty_results_channel',
      'claim-channel': 'claim_channel',
      'points-channel': 'game_points_channel',
      'game-results': 'hangry_results_channel',
    };

    if (channelSubcommands[sub]) {
      const channel = interaction.options.getChannel('channel');
      await db.setGuildConfig(guildId, channelSubcommands[sub], channel.id);
      const labels = {
        'bounty-review': 'Bounty review channel',
        'bounty-results': 'Bounty results channel',
        'claim-channel': 'Claim ticket channel',
        'points-channel': 'Points announcement channel',
        'game-results': 'Game results channel',
      };
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} **${labels[sub]}** set to <#${channel.id}>`)], ephemeral: true });
    }

    // ── Game channel ───────────────────────────────────────────────────────────
    if (sub === 'game-channel') {
      const game = interaction.options.getString('game');
      const channel = interaction.options.getChannel('channel');
      const action = interaction.options.getString('action') || 'add';
      const configKey = CONFIG_KEYS[game];
      const existing = await db.getGuildConfig(guildId, configKey);
      let channels = existing ? JSON.parse(existing) : [];
      if (action === 'add') {
        if (!channels.includes(channel.id)) channels.push(channel.id);
        await db.setGuildConfig(guildId, configKey, JSON.stringify(channels));
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Now tracking **${GAME_LABELS[game]}** in <#${channel.id}>`)], ephemeral: true });
      } else {
        channels = channels.filter(id => id !== channel.id);
        await db.setGuildConfig(guildId, configKey, JSON.stringify(channels));
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Stopped tracking **${GAME_LABELS[game]}** in <#${channel.id}>`)], ephemeral: true });
      }
    }

    // ── Win points ─────────────────────────────────────────────────────────────
    if (sub === 'win-points') {
      const game = interaction.options.getString('game');
      const points = interaction.options.getInteger('points');
      await db.setGuildConfig(guildId, `${game}_win_points`, String(points));
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} **${GAME_LABELS[game] || game}** wins now award **${points} team points**.`)], ephemeral: true });
    }

    // ── Score role ─────────────────────────────────────────────────────────────
    if (sub === 'score-role') {
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      if (action === 'add') {
        await db.addPermRole('score', role.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} **${role.name}** can now add & remove points.`)], ephemeral: true });
      } else {
        await db.removePermRole('score', role.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} **${role.name}** can no longer add & remove points.`)], ephemeral: true });
      }
    }

    // ── Season dates ───────────────────────────────────────────────────────────
    if (sub === 'season-start' || sub === 'season-end') {
      const date = interaction.options.getString('date');
      if (isNaN(Date.parse(date))) return interaction.reply({ content: '❌ Invalid date. Use YYYY-MM-DD.', ephemeral: true });
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ content: '❌ No active session.', ephemeral: true });
      const field = sub === 'season-start' ? 'start_date' : 'end_date';
      await db.updateSession(session.id, { [field]: date });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Season ${sub === 'season-start' ? 'start' : 'end'} date set to **${date}**`)], ephemeral: true });
    }

    // ── Scoreboard ─────────────────────────────────────────────────────────────
    if (sub === 'scoreboard') {
      const session = await db.getActiveSession();
      if (!session) return interaction.reply({ content: '❌ No active session.', ephemeral: true });
      const teams = await db.getTeamsBySession(session.id);
      const members = await db.getMembersBySession(session.id);
      const { buildScoreboardEmbed } = require('../../utils/embeds');
      const embed = buildScoreboardEmbed(session, teams, members);
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await db.updateSession(session.id, { scoreboard_channel_id: interaction.channelId, scoreboard_message_id: msg.id });
      return;
    }

    // ── View settings ──────────────────────────────────────────────────────────
    if (sub === 'view') {
      const keys = [
        ['bounty_review_channel', 'Bounty Review'],
        ['bounty_results_channel', 'Bounty Results'],
        ['claim_channel', 'Claim Tickets'],
        ['game_points_channel', 'Points Announcements'],
        ['hangry_results_channel', 'Game Results'],
        ['hangry_channels', 'Hangry Games Channels'],
        ['rumble_royale_channels', 'Rumble Royale Channels'],
        ['rumble_slaughter_channels', 'Rumble Slaughter Channels'],
        ['regret_games_channels', 'Regret Games Channels'],
        ['hangrygames_win_points', 'Hangry Win Points'],
        ['rumbleroyale_win_points', 'Rumble Royale Win Points'],
        ['rumbleslaughter_win_points', 'Rumble Slaughter Win Points'],
        ['regretgames_win_points', 'Regret Games Win Points'],
      ];

      const lines = [];
      for (const [key, label] of keys) {
        const val = await db.getGuildConfig(guildId, key);
        if (!val) continue;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) lines.push(`**${label}:** ${parsed.map(id => `<#${id}>`).join(', ')}`);
          else lines.push(`**${label}:** <#${val}>`);
        } catch {
          lines.push(`**${label}:** \`${val}\``);
        }
      }

      const scoreRoles = await db.getPermRoles('score');
      if (scoreRoles.length) lines.push(`**Score Roles:** ${scoreRoles.map(id => `<@&${id}>`).join(', ')}`);

      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Prestige Tracker — Settings`)
        .setDescription(lines.length ? lines.join('\n') : '*No settings configured yet.*')
        .setFooter({ text: 'Use /setup [subcommand] to configure' })
        .setTimestamp()
      ], ephemeral: true });
    }
  },
};
