// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

const commandMap = new Map();

function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      const mod = require(fullPath);
      const items = Array.isArray(mod) ? mod : [mod];
      for (const item of items) {
        if (item.data) {
          const command = item.data.toJSON();
          if (commandMap.has(command.name)) {
            console.warn(`[Duplicate Command] /${command.name} — using definition from ${fullPath}`);
          }
          commandMap.set(command.name, command);
        }
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));
const commands = [...commandMap.values()];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Slash commands deployed!');
    commands.forEach(c => console.log(`  /${c.name}`));
  } catch (error) {
    console.error('[Slash Command Deployment Failed]', {
      code: error.code,
      status: error.status,
      message: error.message,
      validation: error.rawError?.errors || null,
    });
    // Keep Railway running so the bot remains available while a bad command is repaired.
    process.exitCode = 0;
  }
})();
