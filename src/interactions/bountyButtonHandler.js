const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database');
const { LAVENDER, E } = require('../utils/bountyEmbeds');
const { buildBountyBoardEmbed } = require('../utils/bountyBoard');
const { isAdmin } = require('../utils/permissions');

const TYPE_LABELS = {
  kill:    b => `Kill **${b.target_username}**`,
  avenge:  b => `Avenge **${b.target_username}**`,
  death:   b => `Death #${b.death_number}`,
  suicide: b => `Suicide #${b.death_number}`,
  winner:  ()  => 'Win the match',
};

function guildFooter(interaction) {
  return interaction.guild?.name ? `${interaction.guild.name} • Orbit Tracker` : 'Orbit Tracker';
}

async function refreshBountyBoard(client, bounty, guildId, guildName) {
  if (!bounty?.session_id) return;
  try {
    const msgData = await db.getGuildConfig(guildId, `bounty_board_msg_${bounty.session_id}`);
    if (!msgData) return;
    const { channelId, messageId } = JSON.parse(msgData);
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;
    const session = await db.getBountySessionById(bounty.session_id).catch(() => null);
    if (!session) return;
    const bounties = await db.getAllSessionBounties(bounty.session_id).catch(() => []);
    const embed = buildBountyBoardEmbed(session, bounties, guildName);
    await message.edit({ embeds: [embed] });
  } catch (e) {
    console.error('[BountyBoard] Failed to refresh:', e.message);
  }
}

async function handleBountyButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('bounty_approve_')) {
    if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Only staff can approve bounties.', ephemeral: true });
    const id = parseInt(customId.replace('bounty_approve_', ''));
    await db.approveBounty(id, interaction.user.id, interaction.user.username);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(LAVENDER)
      .setTitle(`${E.sparkle}  Bounty Approved — #${id}`)
      .addFields({ name: 'Approved by', value: `<@${interaction.user.id}>` })
      .setFooter({ text: guildFooter(interaction) });

    await interaction.update({ embeds: [embed], components: [] });

    const bounty = await db.getBountyById(id);

    // Refresh bounty board
    await refreshBountyBoard(interaction.client, bounty, interaction.guildId, interaction.guild?.name);

    // DM submitter
    if (bounty?.set_by_id) {
      const submitter = await interaction.client.users.fetch(bounty.set_by_id).catch(() => null);
      if (submitter) {
        const session = bounty.session_id ? await db.getBountySessionById(bounty.session_id).catch(() => null) : null;
        const gameLink = session?.game_link || bounty.game_link;
        const typeLabel = (TYPE_LABELS[bounty.type] || (() => bounty.type))(bounty);
        const payeeStr = bounty.payee_id ? `<@${bounty.payee_id}>` : bounty.payee_username;

        const dmEmbed = new EmbedBuilder()
          .setColor(LAVENDER)
          .setTitle(`${E.sparkle}  ${session?.name || 'Bounty'} — #${id} Approved!`)
          .setDescription(
            `Your bounty has been approved and is now active!\n\n` +
            `**Bounty #${id}**\n` +
            `<:wrong:1490116115660275882> **Type:** ${typeLabel}\n` +
            `<a:gift:1527009615508668436> **Prize:** ${bounty.prize}\n` +
            `<a:payout:1527010301944397835> **Donor:** ${payeeStr}\n` +
            `**Set by:** <@${bounty.set_by_id}>\n` +
            (session ? `**Game:** ${session.name}\n` : '') +
            (gameLink ? `\n[Jump to game](${gameLink})` : '')
          )
          .setFooter({ text: guildFooter(interaction) })
          .setTimestamp();

        await submitter.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    }
    return;
  }

  if (customId.startsWith('bounty_reject_')) {
    if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Only staff can reject bounties.', ephemeral: true });
    const id = parseInt(customId.replace('bounty_reject_', ''));
    const modal = new ModalBuilder().setCustomId(`bounty_reject_reason_${id}`).setTitle('Reject Bounty — Reason');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Why is this bounty being rejected?')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300)
    ));
    await interaction.showModal(modal);
    return;
  }
}

async function handleBountyModal(interaction) {
  const { customId } = interaction;
  if (!customId.startsWith('bounty_reject_reason_')) return;
  const id = parseInt(customId.replace('bounty_reject_reason_', ''));
  const reason = interaction.fields.getTextInputValue('reason');
  await db.rejectBounty(id, interaction.user.id, interaction.user.username, reason);
  const bounty = await db.getBountyById(id);
  const typeLabel = bounty ? (TYPE_LABELS[bounty.type] || (() => bounty.type))(bounty) : '';

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`❌  Bounty Rejected — #${id}`)
    .setDescription(`**Reason:** ${reason}\n**Rejected by:** <@${interaction.user.id}>`)
    .setFooter({ text: interaction.guild?.name ? `${interaction.guild.name} • Orbit Tracker` : 'Orbit Tracker' })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] }).catch(async () => {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  });

  if (bounty?.set_by_id) {
    const submitter = await interaction.client.users.fetch(bounty.set_by_id).catch(() => null);
    if (submitter) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`❌  Bounty #${id} Rejected`)
        .setDescription(
          `Your bounty was rejected.\n\n` +
          `**Bounty #${id}**\n` +
          `**Type:** ${typeLabel}\n` +
          `<a:gift:1527009615508668436> **Prize:** ${bounty.prize}\n` +
          `**Reason:** ${reason}`
        )
        .setFooter({ text: interaction.guild?.name ? `${interaction.guild.name} • Orbit Tracker` : 'Orbit Tracker' })
        .setTimestamp();
      await submitter.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  }
}

module.exports = { handleBountyButton, handleBountyModal, refreshBountyBoard };
