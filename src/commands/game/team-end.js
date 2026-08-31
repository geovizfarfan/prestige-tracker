const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { buildWinnerEmbed, errorEmbed, buildSignupButtons } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team-end')
    .setDescription('End the current game session and display final results'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const session = await db.getActiveSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active session.')], ephemeral: true });

    // Defer immediately so Discord doesn't time out
    await interaction.deferReply();

    const teams = await db.getTeamsBySession(session.id);
    const members = await db.getMembersBySession(session.id);
    if (!teams.length) return interaction.editReply({ embeds: [errorEmbed('No teams found.')] });

    const sorted = [...teams].sort((a, b) => b.total_score - a.total_score);
    const winner = sorted[0];
    const mvp = [...members].sort((a, b) => b.individual_score - a.individual_score)[0];

    await db.saveHistory({
      session_id: session.id, session_name: session.name,
      winning_team: `${winner.emoji} ${winner.name}`, winning_score: winner.total_score,
      mvp_user_id: mvp?.user_id || null, mvp_username: mvp?.username || null, mvp_score: mvp?.individual_score || null,
      start_date: session.start_date, end_date: session.end_date,
      team_results: sorted.map(t => ({ name: t.name, emoji: t.emoji, score: t.total_score })),
    });

    // Save member scores to history
    await db.saveMemberHistory(session.id, members);

    await db.updateSession(session.id, { status: 'ended', ended_at: new Date().toISOString() });

    const guild = interaction.guild;
    for (const team of teams) {
      if (!team.role_id) continue;
      try {
        const teamMembers = members.filter(m => m.team_id === team.id);
        for (const m of teamMembers) {
          const gm = await guild.members.fetch(m.user_id).catch(() => null);
          if (gm) await gm.roles.remove(team.role_id).catch(() => {});
        }
        const role = guild.roles.cache.get(team.role_id);
        if (role) await role.delete('Session ended').catch(() => {});
      } catch {}
    }

    if (session.signup_message_id && session.signup_channel_id) {
      try {
        const ch = await guild.channels.fetch(session.signup_channel_id);
        const msg = await ch.messages.fetch(session.signup_message_id);
        await msg.edit({ components: [buildSignupButtons(true)] });
      } catch {}
    }

    const embed = buildWinnerEmbed(session, winner, sorted, members);
    await interaction.editReply({ embeds: [embed] });
  },
};
