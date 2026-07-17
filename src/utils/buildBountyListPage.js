const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAGE_SIZE = 10;

const TYPE_LABELS = {
  kill: b => `Kill **${b.target_username}**`,
  avenge: b => `Avenge **${b.target_username}**`,
  death: b => `Cause death **#${b.death_number}**`,
  winner: () => `Win the match`,
  role_kill: b => `Kill someone with role **${b.role_name}**`,
  every_nth: b => `Every **${b.death_number}** deaths`,
};

function buildBountyListPage(session, bounties, page, userId, hasClaimChannel) {
  const totalPages = Math.max(1, Math.ceil(bounties.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = bounties.slice(start, start + PAGE_SIZE);

  const lines = slice.map(b => {
    const desc = (TYPE_LABELS[b.type] || (() => b.type))(b);
    return `**#${b.id}** ${desc}\n> 🎁 ${b.prize}  ·  💰 ${b.payee_username}  ·  📝 ${b.set_by_username}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0xF0B232)
    .setTitle(`🎯  ${session.name} — Bounties`)
    .setDescription(lines || '*No active bounties for this game.*')
    .setFooter({
      text: `Page ${page + 1} of ${totalPages}  •  ${bounties.length} total` +
            (hasClaimChannel ? `  •  Claim prizes in the claim channel` : '')
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bl_${session.id}_${page - 1}_${userId}`).setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`bl_info_${userId}`).setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`bl_${session.id}_${page + 1}_${userId}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );

  return { embed, row, totalPages };
}

module.exports = { buildBountyListPage, PAGE_SIZE };
