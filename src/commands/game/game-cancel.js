const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { errorEmbed, successEmbed, buildSignupButtons } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-cancel')
    .setDescription('Cancel and delete the current session without saving history'),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;
    const session = await db.getActiveSession() || await db.getPendingSession();
    if (!session) return interaction.reply({ embeds: [errorEmbed('No active or pending session.')], ephemeral: true });

    const teams = await db.getTeamsBySession(session.id);
    const guild = interaction.guild;
    for (const team of teams) {
      if (!team.role_id) continue;
      try {
        const members = await db.getMembersByTeam(team.id);
        for (const m of members) {
          const gm = await guild.members.fetch(m.user_id).catch(() => null);
          if (gm) await gm.roles.remove(team.role_id).catch(() => {});
        }
        const role = guild.roles.cache.get(team.role_id);
        if (role) await role.delete('Session cancelled').catch(() => {});
      } catch {}
    }

    if (session.signup_message_id && session.signup_channel_id) {
      try {
        const ch = await guild.channels.fetch(session.signup_channel_id);
        const msg = await ch.messages.fetch(session.signup_message_id);
        await msg.edit({ components: [buildSignupButtons(true)] });
      } catch {}
    }

    await db.updateSession(session.id, { status: 'ended' });
    await interaction.reply({ embeds: [successEmbed(`Session **${session.name}** has been cancelled.`)] });
  },
};
