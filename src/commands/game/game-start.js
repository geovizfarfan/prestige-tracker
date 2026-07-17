// src/commands/game/game-start.js
const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { TEAM_EMOJIS, buildSignupEmbed, buildSignupButtons, errorEmbed } = require('../../utils/embeds');

const DEFAULT_TEAMS = [
  { name: 'Team Alpha', emoji: '' },
  { name: 'Team Bravo', emoji: '' },
  { name: 'Team Charlie', emoji: '' },
  { name: 'Team Delta', emoji: '' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-start')
    .setDescription('Start a new team game session with signups')
    .addStringOption(o => o.setName('name').setDescription('Session name').setRequired(false))
    .addIntegerOption(o => o.setName('teams').setDescription('Number of teams (2-10)').setMinValue(2).setMaxValue(10).setRequired(false))
    .addStringOption(o => o.setName('team_names').setDescription('Comma-separated team names').setRequired(false)),

  async execute(interaction) {
    if (!await requireAdmin(interaction)) return;

    const existing = await db.getActiveSession();
    if (existing) {
      return interaction.reply({ embeds: [errorEmbed('A session is already active. Use `/game-end` first.')], ephemeral: true });
    }

    const name = interaction.options.getString('name') || 'Season 1';
    const teamCount = interaction.options.getInteger('teams') || 4;
    const teamNamesRaw = interaction.options.getString('team_names');

    const session = await db.createSession(name);
    await db.updateSession(session.id, { status: 'signup' });

    let teamDefs = [];
    if (teamNamesRaw) {
      const names = teamNamesRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
      teamDefs = names.map((n, i) => ({ name: n, emoji: '' }));
    } else {
      for (let i = 0; i < teamCount; i++) {
        teamDefs.push(DEFAULT_TEAMS[i] || { name: `Team ${String.fromCharCode(65 + i)}`, emoji: '' });
      }
    }

    const guild = interaction.guild;
    const teams = [];
    for (const def of teamDefs) {
      let role = null;
      try {
        role = await guild.roles.create({
          name: def.name,
          reason: `Prestige Tracker — ${name}`,
        });
      } catch (e) {
        console.warn(`Could not create role for ${def.name}:`, e.message);
      }
      const team = await db.createTeam(session.id, def.name, def.emoji, role?.id || null);
      teams.push(team);
    }

    const signups = await db.getSignups(session.id);
    const embed = buildSignupEmbed(session, teams, signups, null);
    const row = buildSignupButtons();

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    await db.updateSession(session.id, {
      signup_channel_id: interaction.channelId,
      signup_message_id: msg.id,
    });
  },
};
