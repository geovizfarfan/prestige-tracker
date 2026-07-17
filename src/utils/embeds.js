// src/utils/embeds.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  danger: 0xED4245,
  neutral: 0x2B2D31,
  gold: 0xF0B232,
  purple: 0x9B59B6,
};

const TEAM_EMOJIS = ['<a:red:1490144873649799289>', '<a:blue:1490144871443599522>', '<a:green:1490144874878468217>', '<a:yellow:1490144872483651584>', '<a:purplesparkle:1490116113235972186>', '<a:green:1490144874878468217>', '<a:white:1490144876019318974>', '<a:yellowhangingstarts:1490144877512757421>', '<a:pink:1490144870604476536>', '<a:rainbow:1490145679404826673>'];
const RANK_MEDALS = ['<a:trophy:1490116121800605921>', '<a:secondplacetrophy:1490116116775698724>', '<a:thirdplacetrophy:1490116118583443527>'];

const E = {
  sparkle: { id: '1490116113235972186', name: 'purplesparkle', animated: true  },
  members: { id: '1490116112585724034', name: 'members',       animated: false },
  member:  { id: '1490116421991006268', name: 'member',        animated: false },
  sword:   { id: '1490116114024501400', name: 'sword',         animated: false },
  fire:    { id: '1490116119783018646', name: 'Fire',          animated: true  },
  wrong:   { id: '1490116115660275882', name: 'wrong',         animated: false },
};

function emojiStr(e) {
  return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
}

function buildSignupEmbed(session, teams, signupList, closeTime) {
  const teamNames = teams.map(t => `${t.emoji} **${t.name}**`).join('  •  ');
  const memberCount = signupList.length;
  const memberPreview = signupList.length > 0
    ? signupList.slice(0, 10).map(s => `• ${s.username}`).join('\n')
      + (signupList.length > 10 ? `\n*...and ${signupList.length - 10} more*` : '')
    : '*No signups yet — be the first!*';

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${emojiStr(E.sparkle)}  Team Randomizer — Signups Open!`)
    .setDescription(
      `The Board Princess Server is setting up teams!\n\n` +
      `${emojiStr(E.members)}  **Teams:** ${teamNames}\n\n` +
      `${emojiStr(E.member)}  **Signed Up (${memberCount})**\n${memberPreview}\n\n` +
      `*Click ${emojiStr(E.sword)} Join to enter — teams are assigned randomly for fairness!*`
    )
    .setFooter({ text: `Session: ${session.name}  •  Prestige Tracker` })
    .setTimestamp();
}

function buildSignupButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('signup_join')
      .setLabel('Join')
      .setEmoji({ id: E.sword.id, name: E.sword.name, animated: false })
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('signup_start')
      .setLabel('Start')
      .setEmoji({ id: E.fire.id, name: E.fire.name, animated: true })
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('signup_cancel')
      .setLabel('Cancel')
      .setEmoji({ id: E.wrong.id, name: E.wrong.name, animated: false })
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function buildTeamSessionEmbed(session, teams, members) {
  const teamFields = teams.map(team => {
    const teamMembers = members.filter(m => m.team_id === team.id);
    const memberList = teamMembers.length > 0
      ? teamMembers.map(m => `• ${m.username}`).join('\n')
      : '*No members*';
    return {
      name: `${team.name} · ${teamMembers.length} members`,
      value: memberList,
      inline: true,
    };
  });

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle('<:conroller:1490146060041978038>  Team Sessions — Active! <a:fire1:1490131172800598198>')
    .setDescription(
      `Teams assigned! Roles have been given.\n\n` +
      `**Session:** ${session.name}\n` +
      (session.start_date ? `**Starts:** <t:${Math.floor(new Date(session.start_date).getTime() / 1000)}:D>\n` : '') +
      (session.end_date ? `**Ends:** <t:${Math.floor(new Date(session.end_date).getTime() / 1000)}:D>\n` : '') +
      `**Total players:** \`${members.length}\``
    )
    .addFields(teamFields)
    .setFooter({ text: 'Prestige Tracker  •  Use /score-add to award points' })
    .setTimestamp();
}

function buildJoinLateButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('signup_join_late')
      .setLabel('Join Late')
      .setEmoji({ id: E.sword.id, name: E.sword.name, animated: false })
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildScoreboardEmbed(session, teams, members) {
  const sorted = [...teams].sort((a, b) => b.total_score - a.total_score);
  const topScore = sorted[0]?.total_score || 0;
  const teamLines = sorted.map((team, i) => {
    const medal = RANK_MEDALS[i] || `<a:completed:1490144466668097668>`;
    const memberCount = members.filter(m => m.team_id === team.id).length;
    const bar = buildBar(team.total_score, topScore);
    return `${medal}  ${team.emoji} **${team.name}**\n` +
           `\`${String(team.total_score).padStart(6)} pts\`  ${bar}  \`${memberCount} members\``;
  }).join('\n\n');
  const mvp = [...members].sort((a, b) => b.individual_score - a.individual_score)[0];

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('<a:completed:1490144466668097668>  Live Scoreboard')
    .setDescription(
      (session.name ? `**Session:** ${session.name}\n` : '') +
      (session.start_date ? `**Started:** <t:${Math.floor(new Date(session.start_date).getTime() / 1000)}:D>\n` : '') +
      (session.end_date ? `**Ends:** <t:${Math.floor(new Date(session.end_date).getTime() / 1000)}:D>\n` : '') +
      `**Players:** \`${members.length}\`\n\n` +
      `${teamLines}\n\n` +
      (mvp ? `**<a:star1:1490131407903653949> MVP:** ${mvp.username}  —  \`${mvp.individual_score} pts\`` : '')
    )
    .setFooter({ text: `Updates automatically  •  Prestige Tracker` })
    .setTimestamp();
}

function buildBar(value, max, length = 8) {
  if (max === 0) return '░'.repeat(length);
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function buildTeamLeaderboardEmbed(session, teams, members) {
  const sorted = [...teams].sort((a, b) => b.total_score - a.total_score);
  const lines = sorted.map((team, i) => {
    const medal = RANK_MEDALS[i] || `<a:completed:1490144466668097668>`;
    const memberCount = members.filter(m => m.team_id === team.id).length;
    return `${medal}  ${team.emoji} **${team.name}**  —  \`${team.total_score} pts\`  *(${memberCount} members)*`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle('<a:purplesparkle:1490116113235972186>  Team Leaderboard  <a:purplesparkle:1490116113235972186>')
    .setDescription(lines || '*No teams found.*')
    .setFooter({ text: `Session: ${session.name}  •  Prestige Tracker` })
    .setTimestamp();
}

function buildMemberLeaderboardEmbed(session, members) {
  const sorted = [...members].sort((a, b) => b.individual_score - a.individual_score).slice(0, 15);
  const lines = sorted.map((m, i) => {
    const medal = RANK_MEDALS[i] || `<a:completed:1490144466668097668>`;
    return `${medal}  **${m.username}**  ${m.team_emoji || ''}  —  \`${m.individual_score} pts\``;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.purple)
    .setTitle('<a:star1:1490131407903653949>  Member Leaderboard')
    .setDescription(lines || '*No members found.*')
    .setFooter({ text: `Session: ${session.name}  •  Prestige Tracker` })
    .setTimestamp();
}

function buildWinnerEmbed(session, winningTeam, teams, members) {
  const sorted = [...teams].sort((a, b) => b.total_score - a.total_score);
  const mvp = [...members].sort((a, b) => b.individual_score - a.individual_score)[0];
  const teamResults = sorted.map((team, i) => {
    const medal = RANK_MEDALS[i] || `<a:completed:1490144466668097668>`;
    return `${medal}  ${team.emoji} **${team.name}**  —  \`${team.total_score} pts\``;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`<a:confetti:1490131988257050664>  Game Over — ${winningTeam.emoji} ${winningTeam.name} Wins!`)
    .setDescription(
      `**Final Standings:**\n${teamResults}\n\n` +
      (mvp ? `**<a:star1:1490131407903653949> MVP:** ${mvp.username}  —  \`${mvp.individual_score} pts\`\n\n` : '') +
      `*Session "${session.name}" has ended. Thanks for playing!*`
    )
    .setFooter({ text: 'Prestige Tracker  •  Session Complete' })
    .setTimestamp();
}

function buildHistoryEmbed(history) {
  const lines = history.map((h, i) => {
    const endedAt = h.ended_at ? `<t:${Math.floor(new Date(h.ended_at).getTime() / 1000)}:D>` : 'Unknown';
    let teamResults = [];
    try { teamResults = JSON.parse(h.team_results || '[]'); } catch {}
    const top3 = teamResults.slice(0, 3).map((t, j) => `${RANK_MEDALS[j] || '<a:completed:1490144466668097668>'} ${t.name} \`${t.score}pts\``).join('  ');
    return `**${i + 1}. ${h.session_name}**  ·  ${endedAt}\n` +
           `> <a:trophy:1490116121800605921> **${h.winning_team || 'N/A'}**  ·  ${top3}\n` +
           (h.mvp_username ? `> <a:purplesparkle:1490116113235972186> MVP: ${h.mvp_username} \`${h.mvp_score}pts\`` : '');
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle('<a:Fire:1490116119783018646>  Session History')
    .setDescription(lines || '*No session history yet.*')
    .setFooter({ text: 'Prestige Tracker' })
    .setTimestamp();
}

function buildMemberInfoEmbed(member, session) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`<:members:1490116112585724034>  ${member.username}`)
    .addFields(
      { name: 'Team', value: member.team_name ? `${member.team_emoji || ''} ${member.team_name}` : 'Unassigned', inline: true },
      { name: 'Score', value: `\`${member.individual_score} pts\``, inline: true },
      { name: 'Joined Late', value: member.joined_late ? 'Yes' : 'No', inline: true },
    )
    .setFooter({ text: `Session: ${session.name}  •  Prestige Tracker` })
    .setTimestamp();
}

function buildSessionInfoEmbed(session, teams, members, signups) {
  const statusMap = {
    pending: '<:dashyellow:1490147563091918928> Pending',
    signup: '<:teal:1490147373370839090> Signups Open',
    active: '<:greendot:1490144237856231655> Active',
    ended: '<:reddot:1490144239403925544> Ended'
  };
  const teamList = teams.map(t => {
    const count = members.filter(m => m.team_id === t.id).length;
    return `${t.emoji} **${t.name}** — \`${count} members\` · \`${t.total_score} pts\``;
  }).join('\n') || '*No teams*';

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`<a:fire1:1490131172800598198>  Session Info — ${session.name}`)
    .addFields(
      { name: 'Status', value: statusMap[session.status] || session.status, inline: true },
      { name: 'Teams', value: `\`${teams.length}\``, inline: true },
      { name: 'Members', value: `\`${members.length}\``, inline: true },
      { name: 'Signups (queue)', value: `\`${signups?.length || 0}\``, inline: true },
      { name: 'Start Date', value: session.start_date ? `<t:${Math.floor(new Date(session.start_date).getTime() / 1000)}:D>` : 'Not set', inline: true },
      { name: 'End Date', value: session.end_date ? `<t:${Math.floor(new Date(session.end_date).getTime() / 1000)}:D>` : 'Not set', inline: true },
      { name: 'Team Overview', value: teamList },
    )
    .setFooter({ text: 'Prestige Tracker' })
    .setTimestamp();
}

function errorEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.danger).setDescription(`<:wrong:1490116115660275882>  ${message}`);
}

function successEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`<:checkmark:1490116111369371678>  ${message}`);
}

function infoEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.primary).setDescription(`<:dontpanic:1490116114947244133>  ${message}`);
}

module.exports = {
  COLORS, TEAM_EMOJIS, RANK_MEDALS,
  buildSignupEmbed, buildSignupButtons,
  buildTeamSessionEmbed, buildJoinLateButton,
  buildScoreboardEmbed, buildBar,
  buildTeamLeaderboardEmbed, buildMemberLeaderboardEmbed,
  buildWinnerEmbed, buildHistoryEmbed,
  buildMemberInfoEmbed, buildSessionInfoEmbed,
  errorEmbed, successEmbed, infoEmbed,
};
