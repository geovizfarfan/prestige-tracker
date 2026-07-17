const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database');
const { LAVENDER, E } = require('../utils/bountyEmbeds');
const { isAdmin } = require('../utils/permissions');

async function handleBountyButton(interaction) {
  const { customId } = interaction;

  if (customId.startsWith('bounty_approve_')) {
    if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Only staff can approve bounties.', ephemeral: true });
    const id = parseInt(customId.replace('bounty_approve_', ''));
    await db.approveBounty(id, interaction.user.id, interaction.user.username);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(LAVENDER)
      .setTitle(`${E.sparkle}  Bounty Approved — #${id}`)
      .addFields({ name: 'Approved by', value: `<@${interaction.user.id}>` });
    await interaction.update({ embeds: [embed], components: [] });
    const bounty = await db.getBountyById(id);
    if (bounty?.set_by_id) {
      const submitter = await interaction.client.users.fetch(bounty.set_by_id).catch(() => null);
      if (submitter) await submitter.send(`${E.sparkle} Your bounty **#${id}** (${bounty.prize}) has been approved!`).catch(() => {});
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
  const embed = new EmbedBuilder().setColor(0xED4245).setTitle(`❌  Bounty Rejected — #${id}`)
    .setDescription(`**Reason:** ${reason}\n**Rejected by:** <@${interaction.user.id}>`).setTimestamp();
  await interaction.update({ embeds: [embed], components: [] }).catch(async () => {
    await interaction.reply({ embeds: [embed], ephemeral: true });
  });
  if (bounty?.set_by_id) {
    const submitter = await interaction.client.users.fetch(bounty.set_by_id).catch(() => null);
    if (submitter) await submitter.send(`❌ Your bounty **#${id}** was rejected.\n**Reason:** ${reason}`).catch(() => {});
  }
}

module.exports = { handleBountyButton, handleBountyModal };
