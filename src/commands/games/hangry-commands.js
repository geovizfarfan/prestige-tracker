const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

module.exports = [
  // ─── hangry-start ─────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('hangry-start')
      .setDescription('[ADMIN] Start tracking a Hangry Games session')
      .addStringOption(o => o.setName('game_link').setDescription('Link to the PixxieBot tribute list message (where people join)').setRequired(true))
      .addStringOption(o => o.setName('session').setDescription('Link to an existing bounty session (optional)').setRequired(false).setAutocomplete(true)),

    async autocomplete(interaction) {
      const sessions = await db.getActiveBountySessions(interaction.guildId);
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
      const gameLink = interaction.options.getString('game_link');
      const sessionId = interaction.options.getString('session');

      if (!gameLink.startsWith('https://discord.com/channels/')) {
        return interaction.reply({ content: '❌ Must be a valid Discord message link (right-click the tribute list message → Copy Message Link).', ephemeral: true });
      }

      // Extract channel from link to start tracking
      const parts = gameLink.split('/');
      const channelId = parts[parts.length - 2];

      // Check if channel is registered
      const hangryChannels = await db.getGuildConfig(guildId, 'hangry_channels');
      const channels = hangryChannels ? JSON.parse(hangryChannels) : [];
      if (!channels.includes(channelId)) {
        channels.push(channelId);
        await db.setGuildConfig(guildId, 'hangry_channels', JSON.stringify(channels));
      }

      // Store active game info
      await db.setGuildConfig(guildId, `hangry_active_${channelId}`, JSON.stringify({
        gameLink, channelId, sessionId: sessionId || null,
        startedAt: new Date().toISOString(), guildId,
      }));

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle} Hangry Games tracking started!`)
        .setDescription(
          `Now logging all events in <#${channelId}>\n` +
          `[Jump to game start](${gameLink})\n` +
          (sessionId ? `Linked to bounty session **#${sessionId}**` : 'No bounty session linked — use `/bounty-session-start` to create one')
        )
        .setFooter({ text: 'Prestige Tracker • Hangry Games' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── hangry-end ───────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('hangry-end')
      .setDescription('[ADMIN] Manually end a Hangry Games tracking session'),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const guildId = interaction.guildId;
      const { activeGames } = require('../../games/hangryGamesTracker');

      let ended = 0;
      for (const [channelId, game] of activeGames) {
        if (game.guildId === guildId) {
          activeGames.delete(channelId);
          ended++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Ended **${ended}** active Hangry Games tracking session${ended !== 1 ? 's' : ''}.`);
      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── hangry-stats ─────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('hangry-stats')
      .setDescription('Show Hangry Games leaderboard')
      .addStringOption(o => o.setName('type').setDescription('Stat type').setRequired(false).addChoices(
        { name: 'Wins', value: 'wins' },
        { name: 'Kills', value: 'kills' },
        { name: 'Suicides', value: 'suicides' },
        { name: 'Avenges', value: 'avenges' },
      )),

    async execute(interaction) {
      await interaction.deferReply();
      const type = interaction.options.getString('type') || 'wins';
      const stats = await db.getHangryStats(15);
      const data = stats[type] || [];

      if (!data.length) return interaction.editReply({ content: `❌ No ${type} data tracked yet.` });

      const nameKey = type === 'wins' ? 'winner' : type === 'kills' ? 'killer' : type === 'suicides' ? 'victim' : 'avenger';
      const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

      const lines = data.map((row, i) => {
        const medal = RANK_MEDALS[i] || '<a:completed:1490144466668097668>';
        return `${medal}  **${row[nameKey]}** — \`${row[type]}\``;
      }).join('\n');

      const titles = {
        wins: 'Most Wins', kills: 'Most Kills',
        suicides: 'Most Suicides', avenges: 'Most Avenges',
      };

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Hangry Games — ${titles[type]}`)
        .setDescription(lines)
        .setFooter({ text: 'Prestige Tracker • Hangry Games' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ─── hangry-player ────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('hangry-player')
      .setDescription("Show a player's Hangry Games stats")
      .addStringOption(o => o.setName('username').setDescription("Player's display name in Hangry Games").setRequired(true)),

    async execute(interaction) {
      await interaction.deferReply();
      const username = interaction.options.getString('username');
      const stats = await db.getHangryPlayerStats(username);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  ${username} — Hangry Games Stats`)
        .addFields(
          { name: 'Wins', value: `\`${stats.wins}\``, inline: true },
          { name: 'Kills', value: `\`${stats.kills}\``, inline: true },
          { name: 'Deaths', value: `\`${stats.deaths}\``, inline: true },
          { name: 'Suicides', value: `\`${stats.suicides}\``, inline: true },
          { name: 'Avenges', value: `\`${stats.avenges}\``, inline: true },
          { name: 'Times Avenged', value: `\`${stats.timesAvenged}\``, inline: true },
        )
        .setFooter({ text: 'Prestige Tracker • Hangry Games' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ─── hangry-game ──────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('hangry-game')
      .setDescription('Show recap of a specific Hangry Games match')
      .addIntegerOption(o => o.setName('game_number').setDescription('Game number (e.g. 265)').setRequired(true)),

    async execute(interaction) {
      await interaction.deferReply();
      const gameNumber = interaction.options.getInteger('game_number');
      const game = await db.getHangryGame(gameNumber);

      if (!game) return interaction.editReply({ content: `❌ Game #${gameNumber} not found.` });

      const kills = game.events.filter(e => e.type === 'kill');
      const suicides = game.events.filter(e => e.type === 'suicide');
      const avenges = game.events.filter(e => e.avenger);
      const votes = game.events.filter(e => e.type === 'vote');

      const killLines = kills.slice(0, 8).map(k =>
        `> **${k.killer}** killed **${k.victim}**` +
        (k.avenger ? ` *(avenged by ${k.avenger})*` : '') +
        ` — death #${k.death_number}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Hangry Games #${gameNumber} — Recap`)
        .addFields(
          { name: 'Winner', value: game.winner ? `🎉 **${game.winner}**` : 'Unknown', inline: true },
          { name: 'Players', value: `\`${game.total_players || '?'}\``, inline: true },
          { name: 'Deaths', value: `\`${game.total_deaths || 0}\``, inline: true },
          { name: 'Kills', value: `\`${kills.length}\``, inline: true },
          { name: 'Suicides', value: `\`${suicides.length}\``, inline: true },
          { name: 'Vote Elims', value: `\`${votes.length}\``, inline: true },
          { name: 'Avenges', value: `\`${avenges.length}\``, inline: true },
        )
        .setFooter({ text: 'Prestige Tracker • Hangry Games' })
        .setTimestamp();

      if (killLines) embed.addFields({ name: 'Kill Feed (first 8)', value: killLines });

      await interaction.editReply({ embeds: [embed] });
    },
  },
];
