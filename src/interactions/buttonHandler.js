const db = require('../db/database');
const { assignTeams, getSmallestTeam } = require('../utils/randomizer');
const { updateScoreboard } = require('../utils/scoreboardUpdater');
const {
  buildSignupEmbed, buildSignupButtons,
  buildTeamSessionEmbed, buildJoinLateButton,
  buildTeamLeaderboardEmbed, buildHistoryEmbed,
  errorEmbed, successEmbed, COLORS, RANK_MEDALS,
} = require('../utils/embeds');
const { buildMemberLeaderboardPage } = require('../utils/buildMemberLeaderboardPage');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function buildLeaderboardTabs(active, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb_teams_${userId}`).setLabel('Team Leaderboard').setEmoji({ id: '1490116121800605921', name: 'trophy', animated: true }).setStyle(active === 'teams' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_members_${userId}`).setLabel('Member Leaderboard').setEmoji({ id: '1490131407903653949', name: 'star1', animated: true }).setStyle(active === 'members' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lb_history_${userId}`).setLabel('Session History').setEmoji({ id: '1490144538688487454', name: '20937blueheartfolder', animated: false }).setStyle(active === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId === 'reset_confirm') {
    const { isOwner } = require('../utils/permissions');
    if (!isOwner(interaction)) return interaction.reply({ content: '❌ Not authorized.', ephemeral: true });
    await db.fullReset();
    return interaction.update({ embeds: [successEmbed('Bot has been fully reset.')], components: [] });
  }
  if (customId === 'reset_cancel') {
    return interaction.update({ embeds: [successEmbed('Reset cancelled.')], components: [] });
  }

  if (customId.startsWith('lb_teams_') || customId.startsWith('lb_members_') || customId.startsWith('lb_history_')) {
    const parts = customId.split('_');
    const ownerId = parts[parts.length - 1];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ Run `/leaderboard` yourself to use these buttons.', ephemeral: true });
    }
    await interaction.deferUpdate();
    const session = await db.getActiveSession();
    if (customId.startsWith('lb_history_')) {
      const history = await db.getHistory(5);
      return interaction.editReply({ embeds: [buildHistoryEmbed(history)], components: [buildLeaderboardTabs('history', ownerId)] });
    }
    if (customId.startsWith('lb_teams_')) {
      const teams = session ? await db.getTeamsBySession(session.id) : [];
      const members = session ? await db.getMembersBySession(session.id) : [];
      const embed = session ? buildTeamLeaderboardEmbed(session, teams, members) : new EmbedBuilder().setColor(COLORS.gold).setTitle('<a:purplesparkle:1490116113235972186>  Team Leaderboard').setDescription('*No active session.*').setTimestamp();
      return interaction.editReply({ embeds: [embed], components: [buildLeaderboardTabs('teams', ownerId)] });
    }
    if (customId.startsWith('lb_members_')) {
      if (!session) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.purple).setTitle('<a:star1:1490131407903653949>  Member Leaderboard').setDescription('*No active session.*').setTimestamp()], components: [buildLeaderboardTabs('members', ownerId)] });
      const members = await db.getMembersBySession(session.id);
      const { embed, row } = buildMemberLeaderboardPage(session, members, 0, ownerId);
      return interaction.editReply({ embeds: [embed], components: [buildLeaderboardTabs('members', ownerId), row] });
    }
  }

  if (customId.startsWith('lb_mp_') && !customId.startsWith('lb_mp_info')) {
    const parts = customId.split('_');
    const ownerId = parts[parts.length - 1];
    const page = parseInt(parts[parts.length - 2]);
    if (interaction.user.id !== ownerId) return interaction.reply({ content: '❌ Run `/leaderboard` yourself to use these buttons.', ephemeral: true });
    if (isNaN(page)) return;
    await interaction.deferUpdate();
    const session = await db.getActiveSession();
    if (!session) return;
    const members = await db.getMembersBySession(session.id);
    const { embed, row } = buildMemberLeaderboardPage(session, members, page, ownerId);
    return interaction.editReply({ embeds: [embed], components: [buildLeaderboardTabs('members', ownerId), row] });
  }


  if (customId.startsWith('bl_') && !customId.startsWith('bl_info_')) {
    const parts = customId.split('_');
    const ownerId = parts[parts.length - 1];
    const page = parseInt(parts[parts.length - 2]);
    const sessionId = parseInt(parts[1]);
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ Run `/bounties` yourself to use these buttons.', ephemeral: true });
    }
    if (isNaN(page)) return;
    await interaction.deferUpdate();
    const session = await db.getBountySessionById(sessionId);
    if (!session) return;
    const bounties = await db.getBounties(sessionId);
    const claimChannel = await db.getConfig('claim_channel');
    const { buildBountyListPage } = require('../utils/buildBountyListPage');
    const { embed, row } = buildBountyListPage(session, bounties, page, ownerId, !!claimChannel);
    return interaction.editReply({ embeds: [embed], components: bounties.length > 10 ? [row] : [] });
  }

  if (customId === 'signup_join') {
    const session = await db.getActiveSession();
    if (!session || session.status !== 'signup') return interaction.reply({ embeds: [errorEmbed('Signups are not open right now.')], ephemeral: true });
    const existing = await db.getSignup(session.id, interaction.user.id);
    if (existing) return interaction.reply({ embeds: [errorEmbed('You have already signed up!')], ephemeral: true });
    await db.addSignup(session.id, interaction.user.id, interaction.user.username);
    const signups = await db.getSignups(session.id);
    const teams = await db.getTeamsBySession(session.id);
    const embed = buildSignupEmbed(session, teams, signups, null);
    await interaction.update({ embeds: [embed], components: [buildSignupButtons()] });
    return;
  }

  if (customId === 'signup_start') {
    const { isAdmin } = require('../utils/permissions');
    if (!isAdmin(interaction)) return interaction.reply({ embeds: [errorEmbed('Only admins can start the game.')], ephemeral: true });
    const session = await db.getActiveSession();
    if (!session || session.status !== 'signup') return interaction.reply({ embeds: [errorEmbed('No signup phase is active.')], ephemeral: true });
    const signups = await db.getSignups(session.id);
    if (!signups.length) return interaction.reply({ embeds: [errorEmbed('No one has signed up yet!')], ephemeral: true });
    await interaction.deferUpdate();
    const teams = await db.getTeamsBySession(session.id);
    const assignment = assignTeams(signups, teams);
    const guild = interaction.guild;
    for (const [teamId, players] of assignment) {
      const team = teams.find(t => t.id === teamId);
      for (const player of players) {
        await db.addMember(session.id, player.user_id, player.username, teamId, 0);
        if (team?.role_id) {
          const gm = await guild.members.fetch(player.user_id).catch(() => null);
          if (gm) await gm.roles.add(team.role_id).catch(() => {});
        }
      }
    }
    await db.clearSignups(session.id);
    await db.updateSession(session.id, { status: 'active' });
    const members = await db.getMembersBySession(session.id);
    const sessionEmbed = buildTeamSessionEmbed(session, teams, members);
    await interaction.editReply({ embeds: [sessionEmbed], components: [buildJoinLateButton()] });
    return;
  }

  if (customId === 'signup_cancel') {
    const { isAdmin } = require('../utils/permissions');
    if (!isAdmin(interaction)) return interaction.reply({ embeds: [errorEmbed('Only admins can cancel.')], ephemeral: true });
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });
    await db.updateSession(session.id, { status: 'ended' });
    await interaction.update({ embeds: [errorEmbed(`Signup for **${session.name}** cancelled.`)], components: [buildSignupButtons(true)] });
    return;
  }

  if (customId === 'signup_join_late') {
    const session = await db.getActiveSession();
    if (!session || session.status !== 'active') return interaction.reply({ embeds: [errorEmbed('No active session to join.')], ephemeral: true });
    const existing = await db.getMember(session.id, interaction.user.id);
    if (existing) return interaction.reply({ embeds: [errorEmbed('You are already in this session!')], ephemeral: true });
    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    const team = getSmallestTeam(teams, members);
    await db.addMember(session.id, interaction.user.id, interaction.user.username, team.id, 1);
    if (team.role_id) {
      const gm = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (gm) await gm.roles.add(team.role_id).catch(() => {});
    }
    const updatedTeams = await db.getTeamsBySession(session.id);
    const updatedMembers = await db.getMembersBySession(session.id);
    const embed = buildTeamSessionEmbed(session, updatedTeams, updatedMembers);
    await interaction.update({ embeds: [embed], components: [buildJoinLateButton()] });
    await interaction.followUp({ embeds: [successEmbed(`Welcome ${interaction.user.username}! You've been placed on **${team.name}**`)], ephemeral: true });
    await updateScoreboard(interaction.client);
    return;
  }
}

module.exports = { handleButton };
