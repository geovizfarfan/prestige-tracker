// src/utils/bountyEmbeds.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const LAVENDER = 0x9B7FD4;

const E = {
  gift:    '<a:gift:1527009615508668436>',
  target:  '<:wrong:1490116115660275882>',
  payout:  '<a:payout:1527010301944397835>',
  loading: '<a:Loading:1527009616951775302>',
  paid:    '<a:1472186128689008842:1527009614787248238>',
  sparkle: '<a:purplesparkle:1490116113235972186>',
};

const TYPE_LABELS = {
  kill:    b => `Kill <@${b.target_id || b.target_username}>`,
  avenge:  b => `Avenge <@${b.target_id || b.target_username}>`,
  death:   b => `Death #${b.death_number}`,
  suicide: b => `Suicide #${b.death_number}`,
  winner:  ()  => 'Win the match',
};

const TYPE_BADGES = {
  kill:    'Kill',
  avenge:  'Avenge',
  death:   'Death',
  suicide: 'Suicide',
  winner:  'Winner',
};

function formatTarget(b) {
  if (b.type === 'kill' || b.type === 'avenge') {
    return b.target_id ? `<@${b.target_id}>` : b.target_username || 'Unknown';
  }
  return null;
}

function buildBountyListEmbed(session, bounties, page, claimChannelId) {
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(bounties.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = bounties.slice(start, start + PAGE_SIZE);

  const lines = slice.map(b => {
    const typeLabel = (TYPE_LABELS[b.type] || (() => b.type))(b);
    const payeeStr = b.payee_id ? `<@${b.payee_id}>` : b.payee_username;
    const target = formatTarget(b);
    return [
      `**#${b.id} — ${typeLabel}**`,
      `${E.gift} ${b.prize}  ${target ? `${E.target} ${target}  ` : ''}${E.payout} ${payeeStr}`,
    ].join('\n');
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(LAVENDER)
    .setTitle(`${E.sparkle}  ${session.name} — Bounties`)
    .setDescription(lines || '*No active bounties for this game.*')
    .setFooter({
      text: `Page ${page + 1} of ${totalPages}  •  ${bounties.length} total` +
            (claimChannelId ? `  •  Claim prizes in #ticket channel` : '')
    })
    .setTimestamp();

  if (session.game_link) embed.setURL(session.game_link);

  return { embed, totalPages, PAGE_SIZE };
}

function buildPayoutTrackerEmbed(session, bounties, gameNumber) {
  const resolved = bounties.filter(b => ['claimed', 'paid', 'na'].includes(b.status));

  const lines = resolved.map(b => {
    const typeLabel = (TYPE_LABELS[b.type] || (() => b.type))(b);
    const payeeStr = b.payee_id ? `<@${b.payee_id}>` : b.payee_username;
    const winnerStr = b.winner_id ? `<@${b.winner_id}>` : (b.winner_username || 'N/A');

    let statusLine;
    if (b.status === 'paid') {
      statusLine = `${E.paid} Paid`;
    } else if (b.status === 'na') {
      statusLine = `N/A — died by suicide`;
    } else {
      statusLine = `${E.loading} Awaiting payout`;
    }

    return [
      `**#${b.id} — ${typeLabel}**`,
      `${E.gift} ${b.prize}  →  winner: **${winnerStr}**  ${E.payout} ${payeeStr}`,
      statusLine,
    ].join('\n');
  }).join('\n\n');

  const pending = resolved.filter(b => b.status === 'claimed').length;
  const paid = resolved.filter(b => b.status === 'paid').length;
  const na = resolved.filter(b => b.status === 'na').length;

  const embed = new EmbedBuilder()
    .setColor(LAVENDER)
    .setTitle(`🎯  ${gameNumber ? `Hangry Games #${gameNumber}` : session.name} — Payout Tracker`)
    .setDescription(lines || '*No resolved bounties yet.*')
    .setFooter({
      text: `Session #${session.id}  •  ${resolved.length} bounties  •  ${paid} paid  •  ${pending} pending  •  ${na} N/A`
    })
    .setTimestamp();

  return embed;
}

function buildReviewEmbed(bounty, session) {
  const typeLabel = (TYPE_LABELS[bounty.type] || (() => bounty.type))(bounty);
  const payeeStr = bounty.payee_id ? `<@${bounty.payee_id}>` : bounty.payee_username;
  const setByStr = bounty.set_by_id ? `<@${bounty.set_by_id}>` : bounty.set_by_username;
  const target = formatTarget(bounty);

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🔍  New Bounty — Pending Approval')
    .setDescription(
      `**#${bounty.id} — ${typeLabel}**\n` +
      `**Game:** ${session.name}\n` +
      `${E.gift} **Prize:** ${bounty.prize}\n` +
      (target ? `${E.target} **Target:** ${target}\n` : '') +
      `${E.payout} **Donor:** ${payeeStr}\n` +
      `**Submitted by:** ${setByStr}` +
      (session.game_link ? `\n**Link:** [Jump to game](${session.game_link})` : '')
    )
    .setFooter({ text: 'Prestige Tracker • Bounty Review' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bounty_approve_${bounty.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bounty_reject_${bounty.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  );

  return { embed, row };
}

function buildAutoResolveEmbed(bounty, session, winnerUsername, winnerId, deathNumber, gameNumber) {
  const typeLabel = (TYPE_LABELS[bounty.type] || (() => bounty.type))(bounty);
  const payeeStr = bounty.payee_id ? `<@${bounty.payee_id}>` : bounty.payee_username;
  const winnerStr = winnerId ? `<@${winnerId}>` : (winnerUsername || 'N/A');
  const isNA = !winnerUsername || winnerUsername === 'N/A';

  return new EmbedBuilder()
    .setColor(isNA ? 0x87898c : LAVENDER)
    .setTitle(`🎯  Bounty ${isNA ? 'N/A' : 'Resolved!'} — #${bounty.id}`)
    .setDescription(
      `**Game:** ${gameNumber ? `Hangry Games #${gameNumber}` : session.name}\n` +
      `**Bounty:** ${TYPE_BADGES[bounty.type]} ${typeLabel}\n` +
      `${E.gift} **Prize:** ${bounty.prize}\n` +
      `${E.payout} **Donor:** ${payeeStr}\n` +
      `**Winner:** ${isNA ? '`N/A` (suicide — no killer)' : winnerStr}\n` +
      (deathNumber ? `**Death #:** ${deathNumber}` : '')
    )
    .setFooter({ text: 'Prestige Tracker • Hangry Games' })
    .setTimestamp();
}

module.exports = {
  LAVENDER, E, TYPE_LABELS, TYPE_BADGES,
  buildBountyListEmbed, buildPayoutTrackerEmbed,
  buildReviewEmbed, buildAutoResolveEmbed,
};
