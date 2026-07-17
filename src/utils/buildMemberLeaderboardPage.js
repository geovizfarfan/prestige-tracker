const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAGE_SIZE = 10;
const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

function buildMemberLeaderboardPage(session, members, page = 0, userId = 'x') {
  const sorted = [...members].sort((a, b) => b.individual_score - a.individual_score);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  const lines = slice.map((m, i) => {
    const rank = start + i;
    const medal = RANK_MEDALS[rank] || '<a:completed:1490144466668097668>';
    return `${medal}  **${m.username}**  ${m.team_emoji || ''}  —  \`${m.individual_score} pts\``;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('<a:star1:1490131407903653949>  Member Leaderboard')
    .setDescription(lines || '*No members found.*')
    .setFooter({ text: `Page ${page + 1} of ${totalPages}  •  ${sorted.length} total  •  Session: ${session.name}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_mp_${page - 1}_${userId}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`lb_mp_info_${userId}`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`lb_mp_${page + 1}_${userId}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return { embed, row, totalPages };
}

module.exports = { buildMemberLeaderboardPage, PAGE_SIZE };
