const { EmbedBuilder } = require('discord.js');
const { LAVENDER, E } = require('./bountyEmbeds');

const GIFT    = '<a:gift:1527009615508668436>';
const PAYOUT  = '<a:payout:1527010301944397835>';
const LOADING = '<a:Loading:1527009616951775302>';
const PAID    = '<a:1472186128689008842:1527009614787248238>';
const WRONG   = '<:wrong:1490116115660275882>';
const CHECK   = '<:checkmark:1490116111369371678>';

const TYPE_EMOJI = {
  kill:    '<a:knife:1534965269905277009>',
  avenge:  '<a:avengers:1527009613151604776>',
  death:   '<a:death:1534973135823306792>',
  suicide: '<a:killme:1534966346633445538>',
  winner:  '<a:gift:1527009615508668436>',
};

const TYPE_LABELS = {
  kill:    b => `Kill ${b.target_id ? `<@${b.target_id}>` : `**${b.target_username}**`}`,
  avenge:  b => `Avenge ${b.target_id ? `<@${b.target_id}>` : `**${b.target_username}**`}`,
  death:   b => `Death #${b.death_number}`,
  suicide: b => `Suicide #${b.death_number}`,
  winner:  ()  => 'Win the match',
};

const STATUS_EMOJI = {
  active:  LOADING,
  claimed: PAID,
  paid:    PAID,
  na:      WRONG,
};

function buildBountyBoardEmbed(session, bounties, guildName) {
  const active = bounties.filter(b => b.status === 'active');
  const resolved = bounties.filter(b => ['claimed', 'paid', 'na'].includes(b.status));

  const activeLines = active.length > 0
    ? active.map((b, i) => {
        const num = i + 1;
        const typeEmoji = TYPE_EMOJI[b.type] || GIFT;
        const label = (TYPE_LABELS[b.type] || (() => b.type))(b);
        const payee = b.payee_id ? `<@${b.payee_id}>` : `**${b.payee_username}**`;
        return `**#${num}** ${typeEmoji} ${label}\n${GIFT} Prize: ${b.prize}  ·  ${PAYOUT} Payee: ${payee}`;
      }).join('\n\n')
    : `*No active bounties yet — use \`/addbounty\` to place one!*`;

  const embed = new EmbedBuilder()
    .setColor(LAVENDER)
    .setTitle(`${E.sparkle}  ${session.name} — Bounty Board`)
    .setDescription(activeLines);

  if (session.game_link) embed.setURL(session.game_link);

  if (resolved.length > 0) {
    const resolvedLines = resolved.map((b, i) => {
      const num = active.length + i + 1;
      const typeEmoji = TYPE_EMOJI[b.type] || GIFT;
      const label = (TYPE_LABELS[b.type] || (() => b.type))(b);
      const winner = b.winner_id ? `<@${b.winner_id}>` : (b.winner_username === 'N/A' ? 'N/A' : `**${b.winner_username}**`);
      const emoji = STATUS_EMOJI[b.status] || '';
      return `${emoji} **#${num}** ${typeEmoji} ${label} → ${winner}`;
    }).join('\n');
    embed.addFields({ name: `${CHECK} Resolved (${resolved.length})`, value: resolvedLines.slice(0, 1024) });
  }

  embed
    .setFooter({ text: `${guildName} • Orbit Tracker  •  ${active.length} active  ·  ${resolved.length} resolved` })
    .setTimestamp();

  return embed;
}

module.exports = { buildBountyBoardEmbed };
