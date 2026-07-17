const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db/database');
const { buildBountyListEmbed } = require('../../utils/bountyEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounties')
    .setDescription('Show active bounties for a specific game session')
    .addStringOption(o => o.setName('session').setDescription('Which game to view bounties for').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const sessions = await db.getActiveBountySessions(interaction.guildId);
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = sessions
      .filter(s => s.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(s => ({ name: `#${s.id} — ${s.name}`, value: String(s.id) }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sessionId = parseInt(interaction.options.getString('session'));
    const session = await db.getBountySessionById(sessionId);
    if (!session) return interaction.reply({ content: '❌ Game session not found.', ephemeral: true });

    const bounties = await db.getBounties(sessionId);
    const claimChannelId = await db.getGuildConfig(guildId, 'claim_channel');
    const { embed, totalPages, PAGE_SIZE } = buildBountyListEmbed(session, bounties, 0, claimChannelId);

    const userId = interaction.user.id;
    const row = totalPages > 1 ? new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bl_${sessionId}_0_prev_${userId}`).setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`bl_info`).setLabel(`1 / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`bl_${sessionId}_1_next_${userId}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary),
    ) : null;

    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};
