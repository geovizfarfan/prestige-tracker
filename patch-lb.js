const fs = require('fs');
let c = fs.readFileSync('src/interactions/buttonHandler.js', 'utf8');

const addition = `
  if (customId === 'lb_teams' || customId === 'lb_members') {
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    const { buildTeamLeaderboardEmbed, buildMemberLeaderboardEmbed } = require('../utils/embeds');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lb_teams').setLabel('Team Leaderboard').setEmoji({ id: '1490116121800605921', name: 'trophy', animated: true }).setStyle(customId === 'lb_teams' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('lb_members').setLabel('Member Leaderboard').setEmoji({ id: '1490131407903653949', name: 'star1', animated: true }).setStyle(customId === 'lb_members' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
    const embed = customId === 'lb_teams' ? buildTeamLeaderboardEmbed(session, teams, members) : buildMemberLeaderboardEmbed(session, members);
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

`;

c = c.replace("  if (customId === 'signup_join') {", addition + "  if (customId === 'signup_join') {");
fs.writeFileSync('src/interactions/buttonHandler.js', c);
console.log('done');
