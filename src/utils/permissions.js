// src/utils/permissions.js
const { PermissionFlagsBits } = require('discord.js');

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID;
}

function isAdmin(interaction) {
  return isOwner(interaction) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

async function hasScorePermission(interaction) {
  if (isAdmin(interaction)) return true;
  try {
    const db = require('../db/database');
    const roles = await db.getPermRoles('score');
    if (!roles.length) return false;
    const memberRoles = interaction.member?.roles?.cache;
    return roles.some(id => memberRoles?.has(id));
  } catch { return false; }
}

async function requireOwner(interaction) {
  if (!isOwner(interaction)) {
    await interaction.reply({ content: '❌ This command is restricted to the bot owner.', ephemeral: true });
    return false;
  }
  return true;
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '❌ This command requires Administrator permissions.', ephemeral: true });
    return false;
  }
  return true;
}

async function requireScorePermission(interaction) {
  if (!await hasScorePermission(interaction)) {
    await interaction.reply({ content: '❌ You do not have permission to modify scores.', ephemeral: true });
    return false;
  }
  return true;
}

module.exports = { isOwner, isAdmin, hasScorePermission, requireOwner, requireAdmin, requireScorePermission };
