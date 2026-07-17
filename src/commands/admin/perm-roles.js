const { SlashCommandBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { successEmbed, errorEmbed, COLORS } = require('../../utils/embeds');
const { EmbedBuilder } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('set-score-role')
      .setDescription('Add or remove a role that can add/remove points')
      .addStringOption(o => o.setName('action').setDescription('Add or remove').addChoices(
        { name: 'Add role', value: 'add' },
        { name: 'Remove role', value: 'remove' },
      ).setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('The role').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');

      if (action === 'add') {
        await db.addPermRole('score', role.id);
        await interaction.reply({ embeds: [successEmbed(`**${role.name}** can now add & remove points.`)] });
      } else {
        await db.removePermRole('score', role.id);
        await interaction.reply({ embeds: [successEmbed(`**${role.name}** can no longer add & remove points.`)] });
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('view-score-roles')
      .setDescription('View all roles that can add/remove points'),

    async execute(interaction) {
      const roles = await db.getPermRoles('score');
      const list = roles.length > 0
        ? roles.map(id => `<@&${id}>`).join('\n')
        : '*No roles set — only admins can score*';

      const embed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle('🔑  Score Permission Roles')
        .setDescription(list)
        .setFooter({ text: 'Use /set-score-role to add or remove roles' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },
];
