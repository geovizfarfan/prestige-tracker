// src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { handleButton } = require('./interactions/buttonHandler');
const { handlePixxieBotMessage } = require('./games/hangryGamesHandler');
const { handleRumbleRoyaleMessage } = require('./games/rumbleRoyaleGameHandler');
const { handleBountyButton, handleBountyModal } = require('./interactions/bountyButtonHandler');
const db = require('./db/database');
const { updateScoreboard } = require('./utils/scoreboardUpdater');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

function loadCommandFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommandFiles(fullPath);
    } else if (file.name.endsWith('.js')) {
      const mod = require(fullPath);
      const commands = Array.isArray(mod) ? mod : [mod];
      for (const cmd of commands) {
        if (cmd.data && cmd.execute) {
          client.commands.set(cmd.data.name, cmd);
        }
      }
    }
  }
}

loadCommandFiles(path.join(__dirname, 'commands'));

client.once(Events.ClientReady, async () => {
  console.log(`Connecting to database...`);
  try {
    await db.initSchema();
    console.log(`[DB] Schema ready`);
  } catch (err) {
    console.error(`[DB] Failed to connect:`, err.message);
    process.exit(1);
  }
  console.log(`\n✨ Prestige Tracker online as ${client.user.tag}`);
  console.log(`   Commands loaded: ${client.commands.size}`);
  console.log(`   Guilds: ${client.guilds.cache.size}`);
  // Refresh scoreboard every 2 minutes as fallback
  setInterval(() => updateScoreboard(client), 2 * 60 * 1000);
});

client.on(Events.InteractionCreate, async interaction => {
  const interactionName = interaction.commandName || interaction.customId || 'unknown';
  console.log('[Interaction Received]', {
    type: interaction.type,
    name: interactionName,
    guildId: interaction.guildId,
    userId: interaction.user?.id,
  });

  try {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) await command.autocomplete(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`[Command Not Loaded] /${interaction.commandName}`);
        await interaction.reply({
          content: '❌ This command is registered in Discord but is not loaded by the bot. Please ask the bot owner to refresh the commands.',
          ephemeral: true,
        });
        return;
      }
      console.log(`[Command Start] /${interaction.commandName}`);
      await command.execute(interaction);
      console.log(`[Command Complete] /${interaction.commandName}`);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('bounty_')) {
        await handleBountyButton(interaction);
      } else {
        await handleButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('bounty_reject_reason_')) {
        await handleBountyModal(interaction);
      }
    }
  } catch (err) {
    console.error(`[Interaction Error] ${interactionName}`, err);
    const reply = { content: '❌ An error occurred. Please try again.', ephemeral: true };
    if (interaction.deferred) {
      await interaction.editReply(reply).catch(replyErr => console.error('[Error Reply Failed]', replyErr));
    } else if (interaction.replied) {
      await interaction.followUp(reply).catch(replyErr => console.error('[Follow-up Failed]', replyErr));
    } else {
      await interaction.reply(reply).catch(replyErr => console.error('[Initial Reply Failed]', replyErr));
    }
  }
});

client.on('messageCreate', async message => {
  try { await handlePixxieBotMessage(message); }
  catch (err) { console.error('[Hangry Games]', err.message); }
  try { await handleRumbleRoyaleMessage(message); }
  catch (err) { console.error('[Rumble Royale]', err.message); }
});

process.on('unhandledRejection', err => {
  console.error('[Unhandled Rejection]', err);
});

process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]', err);
});

console.log('Logging in to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Failed to login:', err.message);
  process.exit(1);
});
