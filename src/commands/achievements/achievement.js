const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { requireAdmin } = require('../../utils/permissions');
const db = require('../../db/database');
const { LAVENDER, E } = require('../../utils/bountyEmbeds');

const CHECK = '<:checkmark:1490116111369371678>';
const WRONG = '<:wrong:1490116115660275882>';

async function ensureAchievementTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS achievement_roles (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      game TEXT,
      season TEXT,
      earn_channel_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(guild_id, role_id)
    )
  `);
  await db.query(`ALTER TABLE achievement_roles ADD COLUMN IF NOT EXISTS earn_channel_id TEXT`).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievement')
    .setDescription('Manage achievement roles for the wheel qualification system')

    .addSubcommand(s => s
      .setName('add')
      .setDescription('[ADMIN] Add a required achievement role for this season')
      .addRoleOption(o => o.setName('role').setDescription('The achievement role').setRequired(true))
      .addStringOption(o => o.setName('game').setDescription('How to earn this role (e.g. Win Hangry Games)').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel where members can earn this role').setRequired(false))
      .addStringOption(o => o.setName('season').setDescription('Season name (e.g. Season 3)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('[ADMIN] Remove a role from the achievement list')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('[ADMIN] Clear ALL achievement roles (use after wheel spins for new season)')
    )
    .addSubcommand(s => s
      .setName('list')
      .setDescription('Show all required achievement roles for the current season')
    )
    .addSubcommand(s => s
      .setName('check')
      .setDescription('[ADMIN] Check a specific member\'s achievement progress')
      .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('qualifiers')
      .setDescription('[ADMIN] See all members who qualify for the wheel')
      .addBooleanOption(o => o.setName('show_progress').setDescription('Also show members with partial progress').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    await ensureAchievementTable();

    // ── add ────────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!await requireAdmin(interaction)) return;
      const role = interaction.options.getRole('role');
      const game = interaction.options.getString('game');
      const channel = interaction.options.getChannel('channel');
      const season = interaction.options.getString('season') || 'Current Season';

      await db.query(`
        INSERT INTO achievement_roles (guild_id, role_id, role_name, game, season, earn_channel_id, active)
        VALUES ($1,$2,$3,$4,$5,$6,1)
        ON CONFLICT (guild_id, role_id) DO UPDATE SET role_name=$3, game=$4, season=$5, earn_channel_id=$6, active=1
      `, [guildId, role.id, role.name, game, season, channel?.id || null]);

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(`${E.sparkle} Added <@&${role.id}> to achievement requirements\n> How to earn: **${game}**${channel ? `  in <#${channel.id}>` : ''}  ·  Season: **${season}**`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── remove ─────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!await requireAdmin(interaction)) return;
      const role = interaction.options.getRole('role');
      await db.query(`DELETE FROM achievement_roles WHERE guild_id=$1 AND role_id=$2`, [guildId, role.id]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} Removed <@&${role.id}> from achievement requirements.`)], ephemeral: true });
    }

    // ── reset ──────────────────────────────────────────────────────────────────
    if (sub === 'reset') {
      if (!await requireAdmin(interaction)) return;
      await db.query(`DELETE FROM achievement_roles WHERE guild_id=$1`, [guildId]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`${E.sparkle} All achievement roles cleared. Ready for a new season!`)], ephemeral: true });
    }

    // ── list ───────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const res = await db.query(`SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1 ORDER BY game ASC`, [guildId]);
      if (!res.rows.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(`No achievement roles configured yet. Use \`/achievement add\` to add some.`)], ephemeral: true });

      const season = res.rows[0].season || 'Current Season';
      const lines = res.rows.map(r =>
        `<@&${r.role_id}> — **${r.game}**${r.earn_channel_id ? ` in <#${r.earn_channel_id}>` : ''}`
      ).join('\n');

      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Achievement Roles — ${season}`)
        .setDescription(lines)
        .setFooter({ text: `${res.rows.length} roles required to qualify  •  Prestige Tracker` })
        .setTimestamp()
      ]});
    }

    // ── check ──────────────────────────────────────────────────────────────────
    if (sub === 'check') {
      if (!await requireAdmin(interaction)) return;
      const target = interaction.options.getUser('user');
      const res = await db.query(`SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1 ORDER BY game ASC`, [guildId]);
      if (!res.rows.length) return interaction.reply({ content: '❌ No achievement roles configured.', ephemeral: true });

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Could not fetch that member.', ephemeral: true });

      const memberRoleIds = new Set(member.roles.cache.keys());
      const season = res.rows[0].season || 'Current Season';
      const have = res.rows.filter(r => memberRoleIds.has(r.role_id));
      const missing = res.rows.filter(r => !memberRoleIds.has(r.role_id));
      const qualifies = missing.length === 0;

      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(qualifies ? 0x57F287 : LAVENDER)
        .setTitle(`${E.sparkle}  ${target.username} — Achievement Progress`)
        .setDescription(qualifies ? `${CHECK} **Qualifies for the wheel!** Has all ${res.rows.length} roles.` : `Has **${have.length}/${res.rows.length}** achievement roles.`)
        .addFields(
          { name: `${CHECK} Earned (${have.length})`, value: have.length > 0 ? have.map(r => `<@&${r.role_id}>`).join('\n') : '*None yet*', inline: false },
          { name: `${WRONG} Missing (${missing.length})`, value: missing.length > 0 ? missing.map(r => `<@&${r.role_id}> — **${r.game}**${r.earn_channel_id ? ` in <#${r.earn_channel_id}>` : ''}`).join('\n') : '*None!*', inline: false },
        )
        .setFooter({ text: `Season: ${season}  •  Prestige Tracker` })
        .setTimestamp()
      ], ephemeral: true });
    }

    // ── qualifiers ─────────────────────────────────────────────────────────────
    if (sub === 'qualifiers') {
      if (!await requireAdmin(interaction)) return;
      await interaction.deferReply({ ephemeral: true });

      const res = await db.query(`SELECT * FROM achievement_roles WHERE guild_id=$1 AND active=1`, [guildId]);
      if (!res.rows.length) return interaction.editReply({ content: '❌ No achievement roles configured.' });

      const showProgress = interaction.options.getBoolean('show_progress') || false;
      const requiredRoleIds = res.rows.map(r => r.role_id);
      const season = res.rows[0].season || 'Current Season';

      await interaction.guild.members.fetch();
      const allMembers = interaction.guild.members.cache.filter(m => !m.user.bot);

      const qualified = [], partial = [];
      for (const [, member] of allMembers) {
        const memberRoleIds = new Set(member.roles.cache.keys());
        const haveCount = requiredRoleIds.filter(id => memberRoleIds.has(id)).length;
        if (haveCount === requiredRoleIds.length) qualified.push(member);
        else if (haveCount > 0 && showProgress) partial.push({ member, haveCount, total: requiredRoleIds.length });
      }

      const qualifiedLines = qualified.length > 0
        ? qualified.map(m => `${CHECK} ${m.toString()}`).join('\n')
        : '*No members qualify yet.*';

      const embed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setTitle(`${E.sparkle}  Wheel Qualifiers — ${season}`)
        .setDescription(`**${qualified.length} members** have all **${requiredRoleIds.length}** achievement roles.`)
        .addFields({ name: `${CHECK} Qualified`, value: qualifiedLines.slice(0, 1024), inline: false });

      if (showProgress && partial.length > 0) {
        const partialLines = partial
          .sort((a, b) => b.haveCount - a.haveCount)
          .slice(0, 20)
          .map(p => `${WRONG} ${p.member.toString()} — ${p.haveCount}/${p.total}`)
          .join('\n');
        embed.addFields({ name: `${E.loading} In Progress`, value: partialLines.slice(0, 1024), inline: false });
      }

      embed.setFooter({ text: `${requiredRoleIds.length} roles required  •  Prestige Tracker` }).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
