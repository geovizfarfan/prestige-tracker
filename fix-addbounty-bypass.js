const fs = require('fs');
let c = fs.readFileSync('src/commands/bounties/addbounty.js', 'utf8');

// Add admin/score role bypass before sending to review channel
const oldCode = `    // Send to review channel if configured
    const reviewChannelId = await db.getGuildConfig(guildId, 'bounty_review_channel');
    if (reviewChannelId) {`;

const newCode = `    // Check if user is admin or has a score role - bypass review if so
    const { isAdmin } = require('../../utils/permissions');
    const permRoles = await db.getPermRoles('score').catch(() => []);
    const memberRoles = interaction.member?.roles?.cache;
    const hasPermRole = permRoles.some(roleId => memberRoles?.has(roleId));
    const canBypass = isAdmin(interaction) || hasPermRole;

    if (canBypass) {
      // Auto-approve immediately
      await db.approveBounty(bounty.id, interaction.user.id, interaction.user.username);
      
      // Refresh bounty board
      const { buildBountyBoardEmbed } = require('../../utils/bountyBoard');
      const boardMsgData = await db.getGuildConfig(guildId, \`bounty_board_msg_\${session.id}\`).catch(() => null);
      if (boardMsgData) {
        try {
          const { channelId: bChId, messageId: bMsgId } = JSON.parse(boardMsgData);
          const bCh = await interaction.client.channels.fetch(bChId).catch(() => null);
          if (bCh) {
            const bMsg = await bCh.messages.fetch(bMsgId).catch(() => null);
            if (bMsg) {
              const allBounties = await db.getAllSessionBounties(session.id).catch(() => []);
              const boardEmbed = buildBountyBoardEmbed(session, allBounties, interaction.guild?.name);
              await bMsg.edit({ embeds: [boardEmbed] });
            }
          }
        } catch (e) { console.error('[BountyBoard] bypass refresh failed:', e.message); }
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor(LAVENDER)
        .setDescription(\`\${E.sparkle} Bounty **#\${bounty.id}** is now live! (auto-approved)\`);
      return interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
    }

    // Send to review channel if configured
    const reviewChannelId = await db.getGuildConfig(guildId, 'bounty_review_channel');
    if (reviewChannelId) {`;

c = c.replace(oldCode, newCode);
fs.writeFileSync('src/commands/bounties/addbounty.js', c);
console.log('done');
