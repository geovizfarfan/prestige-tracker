// src/interactions/setupPanelHandler.js
//
// Interactive replacement for the old /setup subcommand list. One command,
// one panel — everything else is buttons, select menus, and modals.
//
// Entry points:
//   buildMainPanel(guildId)      → { embeds, components } for /setup itself
//   isSetupInteraction(interaction) → true if this component/modal belongs to us
//   handleSetupInteraction(interaction) → routes to the right sub-panel

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType,
} = require('discord.js');
const db = require('../db/database');
const { LAVENDER, E } = require('../utils/bountyEmbeds');
const { buildScoreboardEmbed } = require('../utils/embeds');

const CHANNEL_SETTINGS = [
  { key: 'bounty_review_channel', label: 'Bounty Review', desc: 'New bounties go here for staff approval' },
  { key: 'bounty_results_channel', label: 'Bounty Results', desc: 'Bounty resolutions & game recaps post here' },
  { key: 'claim_channel', label: 'Claim Tickets', desc: 'Members claim bounty prizes here' },
  { key: 'game_points_channel', label: 'Points Announcements', desc: 'Team point awards are announced here' },
  { key: 'hangry_results_channel', label: 'Game Results', desc: 'Hangry Games results post here' },
];

const GAMES = [
  { value: 'hangry', label: 'Hangry Games', channelKey: 'hangry_channels', pointsKey: 'hangrygames_win_points' },
  { value: 'rumbleroyale', label: 'Rumble Royale', channelKey: 'rumble_royale_channels', pointsKey: 'rumbleroyale_win_points' },
  { value: 'rumbleslaughter', label: 'Rumble Slaughter', channelKey: 'rumble_slaughter_channels', pointsKey: 'rumbleslaughter_win_points' },
  { value: 'regretgames', label: 'Regret Games', channelKey: 'regret_games_channels', pointsKey: 'regretgames_win_points' },
];

function gameByValue(v) { return GAMES.find(g => g.value === v); }

function backRow(customId = 'setup_back', label = '◀ Back') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary)
  );
}

function baseEmbed(title) {
  return new EmbedBuilder().setColor(LAVENDER).setTitle(title).setTimestamp();
}

// ── Main panel ────────────────────────────────────────────────────────────

async function buildMainPanel(guildId) {
  const allKeys = [
    ...CHANNEL_SETTINGS.map(c => c.key),
    ...GAMES.map(g => g.channelKey),
    ...GAMES.map(g => g.pointsKey),
  ];
  const [values, scoreRoles] = await Promise.all([
    Promise.all(allKeys.map(key => db.getGuildConfig(guildId, key))),
    db.getPermRoles('score'),
  ]);
  const valueMap = {};
  allKeys.forEach((key, i) => { valueMap[key] = values[i]; });

  const lines = [];
  for (const c of CHANNEL_SETTINGS) {
    lines.push(`**${c.label}:** ${valueMap[c.key] ? `<#${valueMap[c.key]}>` : '*not set*'}`);
  }
  const gameChannelLines = GAMES
    .map(g => {
      const raw = valueMap[g.channelKey];
      const list = raw ? JSON.parse(raw) : [];
      return list.length ? `**${g.label}:** ${list.map(id => `<#${id}>`).join(', ')}` : null;
    })
    .filter(Boolean);
  const pointsLines = GAMES
    .map(g => valueMap[g.pointsKey] ? `**${g.label}:** ${valueMap[g.pointsKey]} pts` : null)
    .filter(Boolean);

  const embed = baseEmbed(`${E.sparkle}  Prestige Tracker — Settings`)
    .setDescription(
      `**— Channels —**\n${lines.join('\n')}\n\n` +
      `**— Game Tracking Channels —**\n${gameChannelLines.length ? gameChannelLines.join('\n') : '*none configured*'}\n\n` +
      `**— Win Points —**\n${pointsLines.length ? pointsLines.join('\n') : '*none configured*'}\n\n` +
      `**— Score Roles —**\n${scoreRoles.length ? scoreRoles.map(id => `<@&${id}>`).join(', ') : '*none configured*'}`
    )
    .setFooter({ text: 'Pick a category below to configure it' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_menu')
    .setPlaceholder('Choose what to configure...')
    .addOptions(
      { label: 'Channels', description: 'Bounty review/results, claims, points, game results', value: 'channels', emoji: '📺' },
      { label: 'Game Tracking Channels', description: 'Which channels each game watches for tracking', value: 'game_channels', emoji: '🎮' },
      { label: 'Win Points', description: 'Team points awarded per game win', value: 'win_points', emoji: '🏆' },
      { label: 'Score Roles', description: 'Roles allowed to add/remove team points', value: 'score_roles', emoji: '🛡️' },
      { label: 'Season Dates', description: 'Start/end date for the current team season', value: 'season_dates', emoji: '📅' },
      { label: 'Post Scoreboard', description: 'Post the live scoreboard in this channel', value: 'post_scoreboard', emoji: '📊' },
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// ── Channels sub-panel ───────────────────────────────────────────────────

async function buildChannelsPanel(guildId) {
  const values = await Promise.all(CHANNEL_SETTINGS.map(c => db.getGuildConfig(guildId, c.key)));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_channels_pick')
    .setPlaceholder('Choose a channel setting to edit...')
    .addOptions(CHANNEL_SETTINGS.map((c, i) => ({
      label: c.label,
      description: (values[i] ? `Currently set` : 'Not set') + ` — ${c.desc}`.slice(0, 100 - (values[i] ? 15 : 10)),
      value: c.key,
    })));
  const embed = baseEmbed(`${E.sparkle}  Channels`).setDescription('Pick a setting below, then choose the channel.');
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), backRow()] };
}

function buildChannelPickPanel(key) {
  const setting = CHANNEL_SETTINGS.find(c => c.key === key);
  const embed = baseEmbed(`${E.sparkle}  ${setting.label}`).setDescription(setting.desc);
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`setup_ch:${key}`)
    .setPlaceholder('Select a channel...')
    .addChannelTypes(ChannelType.GuildText);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow('setup_back_channels')] };
}

// ── Game tracking channels sub-panel ─────────────────────────────────────

function buildGamePickPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_game_pick')
    .setPlaceholder('Choose a game...')
    .addOptions(GAMES.map(g => ({ label: g.label, value: g.value })));
  const embed = baseEmbed(`${E.sparkle}  Game Tracking Channels`).setDescription('Pick a game to manage its tracked channels.');
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), backRow()] };
}

async function buildGamePanel(guildId, gameValue) {
  const game = gameByValue(gameValue);
  const raw = await db.getGuildConfig(guildId, game.channelKey);
  const list = raw ? JSON.parse(raw) : [];
  const embed = baseEmbed(`${E.sparkle}  ${game.label} — Tracked Channels`)
    .setDescription(list.length ? list.map(id => `<#${id}>`).join('\n') : '*No channels configured.*');
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup_game_add:${gameValue}`).setLabel('➕ Add Channel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`setup_game_remove:${gameValue}`).setLabel('➖ Remove Channel').setStyle(ButtonStyle.Danger).setDisabled(!list.length),
    new ButtonBuilder().setCustomId('setup_back_game_pick').setLabel('◀ Back').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [buttons] };
}

function buildGameAddChannelPanel(gameValue) {
  const game = gameByValue(gameValue);
  const embed = baseEmbed(`${E.sparkle}  Add a channel for ${game.label}`).setDescription('Select a channel to start tracking.');
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`setup_game_addch:${gameValue}`)
    .setPlaceholder('Select a channel...')
    .addChannelTypes(ChannelType.GuildText);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow(`setup_back_game:${gameValue}`)] };
}

async function buildGameRemoveChannelPanel(guildId, gameValue) {
  const game = gameByValue(gameValue);
  const raw = await db.getGuildConfig(guildId, game.channelKey);
  const list = raw ? JSON.parse(raw) : [];
  const embed = baseEmbed(`${E.sparkle}  Remove channel(s) — ${game.label}`).setDescription('Select which channel(s) to stop tracking.');
  const select = new StringSelectMenuBuilder()
    .setCustomId(`setup_game_removech:${gameValue}`)
    .setPlaceholder('Select channel(s) to remove...')
    .setMinValues(1)
    .setMaxValues(Math.max(1, list.length))
    .addOptions(list.map(id => ({ label: `#${id}`, value: id })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow(`setup_back_game:${gameValue}`)] };
}

// ── Win points sub-panel ─────────────────────────────────────────────────

async function buildPointsPickPanel(guildId) {
  const values = await Promise.all(GAMES.map(g => db.getGuildConfig(guildId, g.pointsKey)));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup_points_pick')
    .setPlaceholder('Choose a game...')
    .addOptions(GAMES.map((g, i) => ({
      label: g.label,
      description: values[i] ? `Currently ${values[i]} pts` : 'Not set',
      value: g.value,
    })));
  const embed = baseEmbed(`${E.sparkle}  Win Points`).setDescription('Pick a game to set its points-per-win.');
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), backRow()] };
}

async function buildPointsPanel(guildId, gameValue) {
  const game = gameByValue(gameValue);
  const current = await db.getGuildConfig(guildId, game.pointsKey);
  const embed = baseEmbed(`${E.sparkle}  ${game.label} — Win Points`)
    .setDescription(`Currently: **${current || '0'} pts** per win`);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup_points_set:${gameValue}`).setLabel('Set Points').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_back_points_pick').setLabel('◀ Back').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [buttons] };
}

function buildPointsModal(gameValue) {
  const game = gameByValue(gameValue);
  const modal = new ModalBuilder().setCustomId(`setup_points_modal:${gameValue}`).setTitle(`${game.label} — Win Points`);
  const input = new TextInputBuilder()
    .setCustomId('points')
    .setLabel('Points per win (0–100)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ── Score roles sub-panel ────────────────────────────────────────────────

async function buildRolesPanel() {
  const roles = await db.getPermRoles('score');
  const embed = baseEmbed(`${E.sparkle}  Score Roles`)
    .setDescription(roles.length ? roles.map(id => `<@&${id}>`).join(', ') : '*No roles configured — only admins can add/remove points.*');
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_roles_add').setLabel('➕ Add Roles').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup_roles_remove').setLabel('➖ Remove Roles').setStyle(ButtonStyle.Danger).setDisabled(!roles.length),
    backRow().components[0],
  );
  return { embeds: [embed], components: [buttons] };
}

function buildRolesAddPanel() {
  const embed = baseEmbed(`${E.sparkle}  Add Score Roles`).setDescription('Select up to 25 roles to grant scoring permission.');
  const select = new RoleSelectMenuBuilder().setCustomId('setup_roles_addsel').setPlaceholder('Select role(s)...').setMinValues(1).setMaxValues(25);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow('setup_back_roles')] };
}

async function buildRolesRemovePanel(guild) {
  const roles = await db.getPermRoles('score');
  const embed = baseEmbed(`${E.sparkle}  Remove Score Roles`).setDescription('Select which role(s) to remove.');
  const select = new StringSelectMenuBuilder()
    .setCustomId('setup_roles_removesel')
    .setPlaceholder('Select role(s) to remove...')
    .setMinValues(1)
    .setMaxValues(Math.max(1, roles.length))
    .addOptions(roles.map(id => ({ label: guild.roles.cache.get(id)?.name || `Unknown role (${id})`, value: id })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow('setup_back_roles')] };
}

// ── Season dates sub-panel ───────────────────────────────────────────────

async function buildDatesPanel() {
  const session = await db.getActiveSession();
  const embed = baseEmbed(`${E.sparkle}  Season Dates`);
  if (!session) {
    embed.setDescription('*No active team session — dates can\'t be set right now.*');
  } else {
    embed.setDescription(`**Start:** ${session.start_date || '*not set*'}\n**End:** ${session.end_date || '*not set*'}`);
  }
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_dates_start').setLabel('Set Start Date').setStyle(ButtonStyle.Primary).setDisabled(!session),
    new ButtonBuilder().setCustomId('setup_dates_end').setLabel('Set End Date').setStyle(ButtonStyle.Primary).setDisabled(!session),
    backRow().components[0],
  );
  return { embeds: [embed], components: [buttons] };
}

function buildDateModal(which) {
  const modal = new ModalBuilder().setCustomId(`setup_dates_modal:${which}`).setTitle(`Season ${which === 'start' ? 'Start' : 'End'} Date`);
  const input = new TextInputBuilder()
    .setCustomId('date')
    .setLabel('Date (YYYY-MM-DD)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ── Dispatch ──────────────────────────────────────────────────────────────

function isSetupInteraction(interaction) {
  return typeof interaction.customId === 'string' && interaction.customId.startsWith('setup_');
}

async function handleSetupInteraction(interaction) {
  const guildId = interaction.guildId;
  const id = interaction.customId;

  // ── String select menus ──────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    const val = interaction.values[0];

    if (id === 'setup_menu') {
      if (val === 'channels') return interaction.update(await buildChannelsPanel(guildId));
      if (val === 'game_channels') return interaction.update(buildGamePickPanel());
      if (val === 'win_points') return interaction.update(await buildPointsPickPanel(guildId));
      if (val === 'score_roles') return interaction.update(await buildRolesPanel());
      if (val === 'season_dates') return interaction.update(await buildDatesPanel());
      if (val === 'post_scoreboard') {
        const session = await db.getActiveSession();
        if (!session) {
          return interaction.update({
            embeds: [baseEmbed(`${E.sparkle}  No Active Session`).setDescription('Start a team session before posting a scoreboard.')],
            components: [backRow()],
          });
        }
        const teams = await db.getTeamsBySession(session.id);
        const members = await db.getMembersBySession(session.id);
        const scoreboardEmbed = buildScoreboardEmbed(session, teams, members);
        const msg = await interaction.channel.send({ embeds: [scoreboardEmbed] });
        await db.updateSession(session.id, { scoreboard_channel_id: interaction.channelId, scoreboard_message_id: msg.id });
        return interaction.update({
          embeds: [baseEmbed(`${E.sparkle}  Scoreboard Posted`).setDescription(`Posted in <#${interaction.channelId}>.`)],
          components: [backRow()],
        });
      }
    }

    if (id === 'setup_channels_pick') return interaction.update(buildChannelPickPanel(val));
    if (id === 'setup_game_pick') return interaction.update(await buildGamePanel(guildId, val));
    if (id === 'setup_points_pick') return interaction.update(await buildPointsPanel(guildId, val));

    if (id.startsWith('setup_game_removech:')) {
      const gameValue = id.split(':')[1];
      const game = gameByValue(gameValue);
      const raw = await db.getGuildConfig(guildId, game.channelKey);
      let list = raw ? JSON.parse(raw) : [];
      list = list.filter(cid => !interaction.values.includes(cid));
      await db.setGuildConfig(guildId, game.channelKey, JSON.stringify(list));
      return interaction.update(await buildGamePanel(guildId, gameValue));
    }

    if (id === 'setup_roles_removesel') {
      for (const roleId of interaction.values) await db.removePermRole('score', roleId);
      return interaction.update(await buildRolesPanel());
    }
    return;
  }

  // ── Channel select menus ─────────────────────────────────────────────
  if (interaction.isChannelSelectMenu()) {
    if (id.startsWith('setup_ch:')) {
      const key = id.split(':')[1];
      await db.setGuildConfig(guildId, key, interaction.values[0]);
      return interaction.update(await buildChannelsPanel(guildId));
    }
    if (id.startsWith('setup_game_addch:')) {
      const gameValue = id.split(':')[1];
      const game = gameByValue(gameValue);
      const raw = await db.getGuildConfig(guildId, game.channelKey);
      const list = raw ? JSON.parse(raw) : [];
      const channelId = interaction.values[0];
      if (!list.includes(channelId)) list.push(channelId);
      await db.setGuildConfig(guildId, game.channelKey, JSON.stringify(list));
      return interaction.update(await buildGamePanel(guildId, gameValue));
    }
    return;
  }

  // ── Role select menus ────────────────────────────────────────────────
  if (interaction.isRoleSelectMenu()) {
    if (id === 'setup_roles_addsel') {
      for (const roleId of interaction.values) await db.addPermRole('score', roleId);
      return interaction.update(await buildRolesPanel());
    }
    return;
  }

  // ── Buttons ───────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (id === 'setup_back') return interaction.update(await buildMainPanel(guildId));
    if (id === 'setup_back_channels') return interaction.update(await buildChannelsPanel(guildId));
    if (id === 'setup_back_game_pick') return interaction.update(buildGamePickPanel());
    if (id === 'setup_back_points_pick') return interaction.update(await buildPointsPickPanel(guildId));
    if (id === 'setup_back_roles') return interaction.update(await buildRolesPanel());
    if (id.startsWith('setup_back_game:')) return interaction.update(await buildGamePanel(guildId, id.split(':')[1]));

    if (id.startsWith('setup_game_add:')) return interaction.update(buildGameAddChannelPanel(id.split(':')[1]));
    if (id.startsWith('setup_game_remove:')) return interaction.update(await buildGameRemoveChannelPanel(guildId, id.split(':')[1]));

    if (id.startsWith('setup_points_set:')) return interaction.showModal(buildPointsModal(id.split(':')[1]));

    if (id === 'setup_roles_add') return interaction.update(buildRolesAddPanel());
    if (id === 'setup_roles_remove') return interaction.update(await buildRolesRemovePanel(interaction.guild));

    if (id === 'setup_dates_start') return interaction.showModal(buildDateModal('start'));
    if (id === 'setup_dates_end') return interaction.showModal(buildDateModal('end'));
    return;
  }

  // ── Modals ────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (id.startsWith('setup_points_modal:')) {
      const gameValue = id.split(':')[1];
      const game = gameByValue(gameValue);
      const raw = interaction.fields.getTextInputValue('points').trim();
      const points = parseInt(raw, 10);
      if (isNaN(points) || points < 0 || points > 100) {
        return interaction.reply({ content: '❌ Points must be a whole number between 0 and 100.', ephemeral: true });
      }
      await db.setGuildConfig(guildId, game.pointsKey, String(points));
      return interaction.update(await buildPointsPanel(guildId, gameValue));
    }

    if (id.startsWith('setup_dates_modal:')) {
      const which = id.split(':')[1];
      const date = interaction.fields.getTextInputValue('date').trim();
      if (isNaN(Date.parse(date))) {
        return interaction.reply({ content: '❌ Invalid date. Use YYYY-MM-DD.', ephemeral: true });
      }
      const session = await db.getActiveSession();
      if (!session) {
        return interaction.reply({ content: '❌ No active team session.', ephemeral: true });
      }
      await db.updateSession(session.id, { [which === 'start' ? 'start_date' : 'end_date']: date });
      return interaction.update(await buildDatesPanel());
    }
    return;
  }
}

module.exports = { buildMainPanel, isSetupInteraction, handleSetupInteraction };
