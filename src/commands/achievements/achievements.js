const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

async function ensureAchievementTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS achievement_roles (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      game TEXT,
      season TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(guild_id, role_id)
    )
  `);
}

module.exports = [
  // ─── achievement-add ────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('achievement-add')
      .setDescription('[ADMIN] Add a role to this season\'s required achievement list')
      .addRoleOption(o => o.setName('role').setDescription('The achievement role').setRequired(true))
      .addStringOption(o => o.setName('game').setDescription('How to earn this role (e.g. Win Hangry Games)').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel where members can earn this role').setRequired(false))
      .addStringOption(o => o.setName('season').setDescription('Season name (optional, e.g. Season 3)').setRequired(false)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      await ensureAchievementTable();

      const role = interaction.options.getRole('role');
      const game = interaction.options.getString('game');
      const season = interaction.options.getString('season') || 'Current Season';
      const guildId = interaction.guildId;

      const channel = interaction.options.getChannel('channel');
      await db.query(`ALTER TABLE achievement_roles ADD COLUMN IF NOT EXISTS earn_channel_id TEXT`).catch(() => {});
      await db.query(`
        INSERT INTO achievement_roles (guild_id, role_id, role_name, game, season, active, earn_channel_id)
        VALUES ($1, $2, $3, $4, $5, 1, $6)
        ON CONFLICT (guild_id, role_id) DO UPDATE SET role_name=$3, game=$4, season=$5, active=1, earn_channel_id=$6
      `, [guildId, role.id, role.name, game, season, channel?.id || null]);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Added **${role.name}** to achievement requirements\n> Earned by: **${game}**  ·  Season: **${season}**`);

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── achievement-remove ─────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('achievement-remove')
      .setDescription('[ADMIN] Remove a role from the achievement list')
      .addRoleOption(o => o.setName('role').setDescription('The role to remove').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      await ensureAchievementTable();

      const role = interaction.options.getRole('role');
      await db.query(`DELETE FROM achievement_roles WHERE guild_id=$1 AND role_id=$2`, [interaction.guildId, role.id]);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Removed **${role.name}** from achievement requirements.`);

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── achievement-reset ──────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('achievement-reset')
      .setDescription('[ADMIN] Clear ALL achievement roles (use after wheel spins for new season)'),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      await ensureAchievementTable();

      await db.query(`DELETE FROM achievement_roles WHERE guild_id=$1`, [interaction.guildId]);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} All achievement roles cleared. Ready for a new season!`);

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── achievement-list ───────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('achievement-list')
      .setDescription('Show all required achievement roles for the current season'),

    async execute(interaction) {
      await ensureAchievementTable();
      const res = await db.query(`
        SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1 ORDER BY game ASC
      `, [interaction.guildId]);

      if (!res.rows.length) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} No achievement roles configured yet. Use \`/achievement-add\` to add some.`)], ephemeral: true });
      }

      const lines = res.rows.map(r => `<@&${r.role_id}> — earned via **${r.game}**`).join('\n');
      const season = res.rows[0].season || 'Current Season';

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Achievement Roles — ${season}`)
        .setDescription(lines)
        .setFooter({ text: `${res.rows.length} roles required to qualify  •  Prestige Tracker` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  },

  // ─── my-achievements ────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('my-achievements')
      .setDescription('Check your achievement role progress and what you\'re missing'),

    async execute(interaction) {
      await ensureAchievementTable();
      const guildId = interaction.guildId;

      const res = await db.query(`
        SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1 ORDER BY game ASC
      `, [guildId]);

      if (!res.rows.length) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription('No achievement roles configured for this season yet.')], ephemeral: true });
      }

      // Fetch member's current roles
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Could not fetch your roles.', ephemeral: true });

      const memberRoleIds = new Set(member.roles.cache.keys());
      const season = res.rows[0].season || 'Current Season';

      const have = res.rows.filter(r => memberRoleIds.has(r.role_id));
      const missing = res.rows.filter(r => !memberRoleIds.has(r.role_id));
      const qualifies = missing.length === 0;

      const haveLines = have.length > 0
        ? have.map(r => `${'<:checkmark:1490116111369371678>'} <@&${r.role_id}>`).join('\n')
        : '*None yet*';

      const missingLines = missing.length > 0
        ? missing.map(r => `${'<:wrong:1490116115660275882>'} <@&${r.role_id}> — play **${r.game}**`).join('\n')
        : '*None — you qualify!* 🎉';

      const embed = new EmbedBuilder()
        .setColor(qualifies ? 0x57F287 : LAVENDER)
        .setTitle(`${E.sparkle}  ${interaction.user.username} — Achievement Progress`)
        .setDescription(qualifies
          ? `🎉 **You have all ${res.rows.length} roles and qualify for the wheel!**`
          : `You have **${have.length}/${res.rows.length}** achievement roles.`)
        .addFields(
          { name: `✅ Earned (${have.length})`, value: haveLines, inline: false },
          { name: `❌ Missing (${missing.length})`, value: missingLines, inline: false },
        )
        .setFooter({ text: `Season: ${season}  •  Prestige Tracker` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  },

  // ─── wheel-qualify ──────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('wheel-qualify')
      .setDescription('[ADMIN] See all members who qualify for the wheel (have all achievement roles)')
      .addBooleanOption(o => o.setName('show_missing').setDescription('Also show members with partial progress').setRequired(false)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      await interaction.deferReply({ ephemeral: true });

      await ensureAchievementTable();
      const guildId = interaction.guildId;

      const res = await db.query(`
        SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1
      `, [guildId]);

      if (!res.rows.length) {
        return interaction.editReply({ content: '❌ No achievement roles configured.' });
      }

      const showMissing = interaction.options.getBoolean('show_missing') || false;
      const requiredRoleIds = res.rows.map(r => r.role_id);
      const season = res.rows[0].season || 'Current Season';

      // Fetch all guild members
      await interaction.guild.members.fetch();
      const allMembers = interaction.guild.members.cache.filter(m => !m.user.bot);

      const qualified = [];
      const partial = [];

      for (const [, member] of allMembers) {
        const memberRoleIds = new Set(member.roles.cache.keys());
        const haveCount = requiredRoleIds.filter(id => memberRoleIds.has(id)).length;
        if (haveCount === requiredRoleIds.length) {
          qualified.push(member);
        } else if (haveCount > 0 && showMissing) {
          partial.push({ member, haveCount, total: requiredRoleIds.length });
        }
      }

      const qualifiedLines = qualified.length > 0
        ? qualified.map(m => `${'<:checkmark:1490116111369371678>'} ${m.toString()}`).join('\n')
        : '*No members qualify yet.*';

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Wheel Qualifiers — ${season}`)
        .setDescription(`**${qualified.length} members** have all **${requiredRoleIds.length}** achievement roles.`)
        .addFields({ name: '✅ Qualified', value: qualifiedLines.slice(0, 1024), inline: false });

      if (showMissing && partial.length > 0) {
        const partialLines = partial
          .sort((a, b) => b.haveCount - a.haveCount)
          .slice(0, 20)
          .map(p => `${'<:wrong:1490116115660275882>'} ${p.member.toString()} — ${p.haveCount}/${p.total}`)
          .join('\n');
        embed.addFields({ name: '⏳ In Progress', value: partialLines.slice(0, 1024), inline: false });
      }

      embed.setFooter({ text: `Prestige Tracker  •  ${requiredRoleIds.length} roles required` }).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    },
  },

  // ─── check-achievements @user (admin) ───────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('check-achievements')
      .setDescription('[ADMIN] Check a specific member\'s achievement progress')
      .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true)),

    async execute(interaction) {
      if (!await requireAdmin(interaction)) return;
      await ensureAchievementTable();

      const target = interaction.options.getUser('user');
      const guildId = interaction.guildId;

      const res = await db.query(`
        SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1 ORDER BY game ASC
      `, [guildId]);

      if (!res.rows.length) return interaction.reply({ content: '❌ No achievement roles configured.', ephemeral: true });

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Could not fetch that member.', ephemeral: true });

      const memberRoleIds = new Set(member.roles.cache.keys());
      const season = res.rows[0].season || 'Current Season';
      const have = res.rows.filter(r => memberRoleIds.has(r.role_id));
      const missing = res.rows.filter(r => !memberRoleIds.has(r.role_id));
      const qualifies = missing.length === 0;

      const embed = new EmbedBuilder()
        .setColor(qualifies ? 0x57F287 : LAVENDER)
        .setTitle(`${E.sparkle}  ${target.username} — Achievement Progress`)
        .setDescription(qualifies
          ? `<:checkmark:1490116111369371678> **Qualifies for the wheel!** Has all ${res.rows.length} roles.`
          : `Has **${have.length}/${res.rows.length}** achievement roles.`)
        .addFields(
          { name: `✅ Earned (${have.length})`, value: have.length > 0 ? have.map(r => `<@&${r.role_id}>`).join('\n') : '*None*', inline: false },
          { name: `❌ Missing (${missing.length})`, value: missing.length > 0 ? missing.map(r => `<@&${r.role_id}> — **${r.game}**`).join('\n') : '*None*', inline: false },
        )
        .setFooter({ text: `Season: ${season}  •  Prestige Tracker` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  },
];
