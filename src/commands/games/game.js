// src/commands/games/game.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');
const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');

const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];
const GAME_LABELS = {
  hangrygames: 'Hangry Games', rumbleroyale: 'Rumble Royale',
  rumbleslaughter: 'Rumble Slaughter', regretgames: 'Regret Games', all: 'All Games',
};

async function getUnifiedStats(guildId, gameType, limit = 15) {
  try {
    const whereGame = gameType !== 'all' ? 'AND game_type = $2' : '';
    const params = gameType !== 'all' ? [guildId, gameType, limit] : [guildId, limit];
    const limitParam = gameType !== 'all' ? '$3' : '$2';
    const wins = await db.query(`SELECT winner_username, winner_id, COUNT(*) as wins FROM unified_game_wins WHERE guild_id = $1 ${whereGame} GROUP BY winner_username, winner_id ORDER BY wins DESC LIMIT ${limitParam}`, params);
    const kills = await db.query(`SELECT killer, COUNT(*) as kills FROM unified_game_events WHERE guild_id = $1 AND event_type = 'kill' AND killer IS NOT NULL ${whereGame} GROUP BY killer ORDER BY kills DESC LIMIT ${limitParam}`, params);
    const suicides = await db.query(`SELECT victim, COUNT(*) as suicides FROM unified_game_events WHERE guild_id = $1 AND event_type = 'suicide' AND victim IS NOT NULL ${whereGame} GROUP BY victim ORDER BY suicides DESC LIMIT ${limitParam}`, params);
    return { wins: wins.rows, kills: kills.rows, suicides: suicides.rows };
  } catch { return { wins: [], kills: [], suicides: [] }; }
}

async function getUnifiedPlayerStats(userId, username, guildId) {
  const games = ['hangrygames', 'rumbleroyale', 'rumbleslaughter', 'regretgames'];
  const stats = {};
  for (const g of games) {
    try {
      const wins = await db.query(`SELECT COUNT(*) as count FROM unified_game_wins WHERE guild_id=$1 AND game_type=$2 AND (winner_id=$3 OR LOWER(winner_username)=LOWER($4))`, [guildId, g, userId, username]);
      const kills = await db.query(`SELECT COUNT(*) as count FROM unified_game_events WHERE guild_id=$1 AND game_type=$2 AND event_type='kill' AND LOWER(killer)=LOWER($3)`, [guildId, g, username]);
      const deaths = await db.query(`SELECT COUNT(*) as count FROM unified_game_events WHERE guild_id=$1 AND game_type=$2 AND event_type IN ('kill','suicide','vote') AND LOWER(victim)=LOWER($3)`, [guildId, g, username]);
      stats[g] = { wins: parseInt(wins.rows[0]?.count || 0), kills: parseInt(kills.rows[0]?.count || 0), deaths: parseInt(deaths.rows[0]?.count || 0) };
    } catch { stats[g] = { wins: 0, kills: 0, deaths: 0 }; }
  }
  try {
    const totalWins = await db.query(`SELECT COUNT(*) as count FROM unified_game_wins WHERE guild_id=$1 AND (winner_id=$2 OR LOWER(winner_username)=LOWER($3))`, [guildId, userId, username]);
    stats.totalWins = parseInt(totalWins.rows[0]?.count || 0);
  } catch { stats.totalWins = 0; }
  return stats;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Hangry Games tracking & cross-game stats')

    .addSubcommand(s => s.setName('start').setDescription('[ADMIN] Start a Hangry Games session and open bounties in one command')
      .addStringOption(o => o.setName('game_link').setDescription('Link to the PixxieBot tribute list message (right-click → Copy Message Link)').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Session name (e.g. "Hangry Games #270") — auto-generated if blank').setRequired(false))
      .addChannelOption(o => o.setName('bounty_channel').setDescription('Channel to post bounty board and results').setRequired(false)))

    .addSubcommand(s => s.setName('hangry-stats').setDescription('Show Hangry Games leaderboard')
      .addStringOption(o => o.setName('type').setDescription('Stat type').setRequired(false).addChoices(
        { name: 'Wins', value: 'wins' }, { name: 'Kills', value: 'kills' },
        { name: 'Suicides', value: 'suicides' }, { name: 'Avenges', value: 'avenges' },
      )))

    .addSubcommand(s => s.setName('hangry-player').setDescription("Show a player's Hangry Games stats")
      .addStringOption(o => o.setName('username').setDescription("Player's display name in Hangry Games").setRequired(true)))

    .addSubcommand(s => s.setName('recap').setDescription('Show recap of a specific Hangry Games match (by game number)')
      .addIntegerOption(o => o.setName('game_number').setDescription('Game number (e.g. 265)').setRequired(true)))

    .addSubcommand(s => s.setName('leaderboard').setDescription('Show win/kill leaderboard for any tracked game')
      .addStringOption(o => o.setName('game').setDescription('Which game').setRequired(true).addChoices(
        { name: 'All Games', value: 'all' }, { name: 'Hangry Games', value: 'hangrygames' },
        { name: 'Rumble Royale', value: 'rumbleroyale' }, { name: 'Rumble Slaughter', value: 'rumbleslaughter' },
        { name: 'Regret Games', value: 'regretgames' },
      ))
      .addStringOption(o => o.setName('type').setDescription('Stat type').setRequired(false).addChoices(
        { name: 'Wins', value: 'wins' }, { name: 'Kills', value: 'kills' }, { name: 'Suicides', value: 'suicides' },
      )))

    .addSubcommand(s => s.setName('player-stats').setDescription("Show a player's stats across ALL tracked games")
      .addUserOption(o => o.setName('user').setDescription('Player to look up').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!await requireAdmin(interaction)) return;
      const guildId = interaction.guildId;
      const gameLink = interaction.options.getString('game_link');
      const bountyChannel = interaction.options.getChannel('bounty_channel');
      if (!gameLink.startsWith('https://discord.com/channels/')) {
        return interaction.reply({ content: '❌ Must be a valid Discord message link (right-click the tribute list → Copy Message Link).', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const parts = gameLink.split('/');
      const channelId = parts[parts.length - 2];
      const sessionName = interaction.options.getString('name') || `Hangry Games — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      const hangryChannels = await db.getGuildConfig(guildId, 'hangry_channels').catch(() => null);
      const channels = hangryChannels ? JSON.parse(hangryChannels) : [];
      if (!channels.includes(channelId)) {
        channels.push(channelId);
        await db.setGuildConfig(guildId, 'hangry_channels', JSON.stringify(channels));
      }

      const bountyChannelId = bountyChannel?.id || await db.getGuildConfig(guildId, 'bounty_results_channel');
      const session = await db.createBountySession({
        guild_id: guildId, name: sessionName, game_channel_id: channelId,
        bounty_channel_id: bountyChannelId || null, game_link: gameLink,
        created_by_id: interaction.user.id, created_by_username: interaction.user.username,
      });

      await db.setGuildConfig(guildId, `hangry_active_${channelId}`, JSON.stringify({
        gameLink, channelId, sessionId: String(session.id), startedAt: new Date().toISOString(), guildId,
      }));

      if (bountyChannelId) {
        try {
          const bChannel = await interaction.client.channels.fetch(bountyChannelId);
          const boardEmbed = buildBountyBoardEmbed(session, [], interaction.guild.name);
          const boardMsg = await bChannel.send({ embeds: [boardEmbed] });
          await db.setGuildConfig(guildId, `bounty_board_msg_${session.id}`, JSON.stringify({ channelId: bountyChannelId, messageId: boardMsg.id }));
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
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'hangry-stats') {
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
      const embed = new EmbedBuilder().setColor(LAVENDER).setTitle(`${E.sparkle}  Hangry Games — ${titles[type]}`).setDescription(lines).setFooter({ text: `${interaction.guild?.name} • Orbit Tracker` }).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'hangry-player') {
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
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'recap') {
      await interaction.deferReply();
      const gameNumber = interaction.options.getInteger('game_number');
      const game = await db.getHangryGame(gameNumber).catch(() => null);
      if (!game) return interaction.editReply({ content: `❌ Game #${gameNumber} not found.` });
      const kills = game.events.filter(e => e.type === 'kill');
      const suicides = game.events.filter(e => e.type === 'suicide');
      const avenges = game.events.filter(e => e.avenger);
      const votes = game.events.filter(e => e.type === 'vote');
      const killLines = kills.slice(0, 8).map(k => `> **${k.killer}** killed **${k.victim}**${k.avenger ? ` *(avenged by ${k.avenger})*` : ''} — death #${k.death_number}`).join('\n');
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
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const game = interaction.options.getString('game');
      const type = interaction.options.getString('type') || 'wins';
      const stats = await getUnifiedStats(interaction.guildId, game, 15);
      const data = stats[type] || [];
      if (!data.length) return interaction.editReply({ content: `❌ No ${type} tracked yet for **${GAME_LABELS[game]}**.` });
      const nameKey = type === 'wins' ? 'winner_username' : type === 'kills' ? 'killer' : 'victim';
      const countKey = type === 'wins' ? 'wins' : type === 'kills' ? 'kills' : 'suicides';
      const lines = data.map((row, i) => {
        const medal = RANK_MEDALS[i] || '<a:completed:1490144466668097668>';
        const name = row.winner_id ? `<@${row.winner_id}>` : `**${row[nameKey]}**`;
        return `${medal}  ${name} — \`${row[countKey]}\``;
      }).join('\n');
      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  ${GAME_LABELS[game]} — ${type === 'wins' ? 'Most Wins' : type === 'kills' ? 'Most Kills' : 'Most Suicides'}`)
        .setDescription(lines)
        .setFooter({ text: 'Prestige Tracker • Game Leaderboard' })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'player-stats') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user');
      const stats = await getUnifiedPlayerStats(target.id, target.username, interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  ${target.username} — All Game Stats`)
        .setDescription(`**Total wins across all games: \`${stats.totalWins}\`**`)
        .addFields(
          { name: 'Hangry Games', value: `Wins: \`${stats.hangrygames.wins}\`  Kills: \`${stats.hangrygames.kills}\`  Deaths: \`${stats.hangrygames.deaths}\``, inline: false },
          { name: 'Rumble Royale', value: `Wins: \`${stats.rumbleroyale.wins}\`  Kills: \`${stats.rumbleroyale.kills}\`  Deaths: \`${stats.rumbleroyale.deaths}\``, inline: false },
          { name: 'Rumble Slaughter', value: `Wins: \`${stats.rumbleslaughter.wins}\`  Kills: \`${stats.rumbleslaughter.kills}\`  Deaths: \`${stats.rumbleslaughter.deaths}\``, inline: false },
          { name: 'Regret Games', value: `Wins: \`${stats.regretgames.wins}\`  Kills: \`${stats.regretgames.kills}\`  Deaths: \`${stats.regretgames.deaths}\``, inline: false },
        )
        .setFooter({ text: 'Prestige Tracker • Player Stats' })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
