const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

const GAME_LABELS = {
  hangrygames: 'Hangry Games', rumbleroyale: 'Rumble Royale',
  rumbleslaughter: 'Rumble Slaughter', regretgames: 'Regret Games', all: 'All Games',
};

const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

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

      await interaction.editReply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('player-stats')
      .setDescription("Show a player's stats across ALL tracked games")
      .addUserOption(o => o.setName('user').setDescription('Player to look up').setRequired(true)),

    async execute(interaction) {
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

      await interaction.editReply({ embeds: [embed] });
    },
  },
];
