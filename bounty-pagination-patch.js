const fs = require('fs');
let c = fs.readFileSync('src/interactions/buttonHandler.js', 'utf8');

if (!c.includes("startsWith('bl_')")) {
  const addition = `
  if (customId.startsWith('bl_') && !customId.startsWith('bl_info_')) {
    const parts = customId.split('_');
    const ownerId = parts[parts.length - 1];
    const page = parseInt(parts[parts.length - 2]);
    const sessionId = parseInt(parts[1]);
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: '❌ Run \`/bounties\` yourself to use these buttons.', ephemeral: true });
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

`;
  c = c.replace("  if (customId === 'signup_join') {", addition + "  if (customId === 'signup_join') {");
  fs.writeFileSync('src/interactions/buttonHandler.js', c);
  console.log('Bounty pagination added to buttonHandler');
} else {
  console.log('Already present');
}
