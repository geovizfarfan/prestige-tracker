const fs = require('fs');
let c = fs.readFileSync('src/commands/bounties/addbounty.js', 'utf8');

// Find the line where bounty is created and add bypass after it
const insertAfter = "    const bounty = await db.addBounty({";

if (!c.includes('canBypass')) {
  // Find end of addBounty call
  const bountyCallEnd = c.indexOf('    });\n', c.indexOf(insertAfter)) + 7;
  
  const bypassCode = `
    // Admin/score role bypass - skip review
    const { isAdmin } = require('../../utils/permissions');
    const permRoles = await db.getPermRoles('score').catch(() => []);
    const memberRoleIds = interaction.member?.roles?.cache ? [...interaction.member.roles.cache.keys()] : [];
    const hasPermRole = permRoles.some(id => memberRoleIds.includes(id));
    const canBypass = isAdmin(interaction) || hasPermRole;

    if (canBypass) {
      await db.approveBounty(bounty.id, interaction.user.id, interaction.user.username);
      // Refresh bounty board
      try {
        const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');
        const boardData = await db.getGuildConfig(guildId, \`bounty_board_msg_\${session.id}\`).catch(() => null);
        if (boardData) {
          const { channelId: bChId, messageId: bMsgId } = JSON.parse(boardData);
          const bCh = await interaction.client.channels.fetch(bChId).catch(() => null);
          const bMsg = bCh ? await bCh.messages.fetch(bMsgId).catch(() => null) : null;
          if (bMsg) {
            const allBounties = await db.getAllSessionBounties(session.id).catch(() => []);
            await bMsg.edit({ embeds: [buildBountyBoardEmbed(session, allBounties, interaction.guild?.name)] });
          }
        }
      } catch(e) { console.error('[bypass board]', e.message); }
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(LAVENDER).setDescription(\`\${E.sparkle} Bounty **#\${bounty.id}** is now live!\`)], ephemeral: true });
    }
`;
  
  c = c.slice(0, bountyCallEnd) + bypassCode + c.slice(bountyCallEnd);
  fs.writeFileSync('src/commands/bounties/addbounty.js', c);
  console.log('Bypass added at position', bountyCallEnd);
} else {
  console.log('Already has bypass');
}
