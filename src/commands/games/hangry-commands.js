const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');
const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');

const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('hangry-start')
      .setDescription('[ADMIN] Start a Hangry Games session and open bounties in one command')
      .addStringOption(o => o.setName('game_link').setDescription('Link to the PixxieBot tribute list message (right-click → Copy Message Link)').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Session name (e.g. "Hangry Games #270") — auto-generated if blank').setRequired(false))
      .addChannelOption(o => o.setName('bounty_channel').setDescription('Channel to post bounty board and results').setRequired(false)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const guildId = interaction.guildId;
      const gameLink = interaction.options.getString('game_link');
      const bountyChannel = interaction.options.getChannel('bounty_channel');

      if (!gameLink.startsWith('https://discord.com/channels/')) {
        return interaction.reply({ content: '❌ Must be a valid Discord message link (right-click the tribute list → Copy Message Link).', ephemeral: true });
      }

      const parts = gameLink.split('/');
      const channelId = parts[parts.length - 2];
      const sessionName = interaction.options.getString('name') || `Hangry Games — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      // Register channel
      const hangryChannels = await db.getGuildConfig(guildId, 'hangry_channels').catch(() => null);
      const channels = hangryChannels ? JSON.parse(hangryChannels) : [];
      if (!channels.includes(channelId)) {
        channels.push(channelId);
        await db.setGuildConfig(guildId, 'hangry_channels', JSON.stringify(channels));
      }

      // Get bounty channel — use provided or fall back to configured results channel
      const bountyChannelId = bountyChannel?.id || await db.getGuildConfig(guildId, 'bounty_results_channel');

      // Create bounty session
      const session = await db.createBountySession({
        guild_id: guildId,
        name: sessionName,
        game_channel_id: channelId,
        bounty_channel_id: bountyChannelId || null,
        game_link: gameLink,
        created_by_id: interaction.user.id,
        created_by_username: interaction.user.username,
      });

      // Store active game info
      await db.setGuildConfig(guildId, `hangry_active_${channelId}`, JSON.stringify({
        gameLink, channelId,
        sessionId: String(session.id),
        startedAt: new Date().toISOString(),
        guildId,
      }));

      // Post bounty board in bounty channel
      if (bountyChannelId) {
        try {
          const bChannel = await interaction.client.channels.fetch(bountyChannelId);
          const boardEmbed = buildBountyBoardEmbed(session, [], interaction.guild.name);
          const boardMsg = await bChannel.send({ embeds: [boardEmbed] });

          // Store message ID so we can edit it later
          await db.setGuildConfig(guildId, `bounty_board_msg_${session.id}`, JSON.stringify({
            channelId: bountyChannelId,
            messageId: boardMsg.id,
          }));
        } catch (e) {
          console.error('[Hangry] Failed to post bounty board:', e.message);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Hangry Games Tracking Started!`)
        .setDescription(
          `**Session:** ${sessionName}\n` +
          `🎮 Game channel: <#${channelId}>\n` +
          `🔗 [Jump to game](${gameLink})\n` +
          (bountyChannelId ? `🎯 Bounty board posted in <#${bountyChannelId}>\n` : '') +
          `\n**Session #${session.id}** — Members can now use \`/addbounty\`!\n` +
          `Orbit Tracker is now watching <#${channelId}> for kills, suicides, votes, and the winner.`
        )
        .setFooter({ text: `${interaction.guild?.name} • Orbit Tracker` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },

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
      const stats = await db.getHangryStats(15).catch(() => ({ wins: [], kills: [], suicides: [], avenges: [] }));
      const data = stats[type] || [];

      if (!data.length) return interaction.editReply({ content: `❌ No ${type} data tracked yet.` });

      const nameKey = type === 'wins' ? 'winner' : type === 'kills' ? 'killer' : type === 'suicides' ? 'victim' : 'avenger';
      const lines = data.map((row, i) => {
        const medal = RANK_MEDALS[i] || '<a:completed:1490144466668097668>';
        return `${medal}  **${row[nameKey]}** — \`${row[type]}\``;
      }).join('\n');

      const titles = { wins: 'Most Wins', kills: 'Most Kills', suicides: 'Most Suicides', avenges: 'Most Avenges' };
      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Hangry Games — ${titles[type]}`)
        .setDescription(lines)
        .setFooter({ text: `${interaction.guild?.name} • Orbit Tracker` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('hangry-player')
      .setDescription("Show a player's Hangry Games stats")
      .addStringOption(o => o.setName('username').setDescription("Player's display name in Hangry Games").setRequired(true)),

    async execute(interaction) {
      await interaction.deferReply();
      const username = interaction.options.getString('username');
      const stats = await db.getHangryPlayerStats(username).catch(() => ({ wins: 0, kills: 0, deaths: 0, suicides: 0, avenges: 0, timesAvenged: 0 }));

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
        .setFooter({ text: `${interaction.guild?.name} • Orbit Tracker` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('game-recap')
      .setDescription('Show recap of a specific Hangry Games match (by game number)')
      .addIntegerOption(o => o.setName('game_number').setDescription('Game number (e.g. 265)').setRequired(true)),

    async execute(interaction) {
      await interaction.deferReply();
      const gameNumber = interaction.options.getInteger('game_number');
      const game = await db.getHangryGame(gameNumber).catch(() => null);

      if (!game) return interaction.editReply({ content: `❌ Game #${gameNumber} not found.` });

      const kills = game.events.filter(e => e.type === 'kill');
      const suicides = game.events.filter(e => e.type === 'suicide');
      const avenges = game.events.filter(e => e.avenger);
      const votes = game.events.filter(e => e.type === 'vote');

      const killLines = kills.slice(0, 8).map(k =>
        `> **${k.killer}** killed **${k.victim}**${k.avenger ? ` *(avenged by ${k.avenger})*` : ''} — death #${k.death_number}`
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
        .setFooter({ text: `${interaction.guild?.name} • Orbit Tracker` })
        .setTimestamp();

      if (killLines) embed.addFields({ name: 'Kill Feed (first 8)', value: killLines });
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
