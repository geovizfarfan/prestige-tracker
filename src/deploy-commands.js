// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

const commands = [];

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
        if (item.data) commands.push(item.data.toJSON());
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  console.log(`Deploying ${commands.length} slash commands...`);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands },
  );
  console.log('✅ Slash commands deployed!');
  commands.forEach(c => console.log(`  /${c.name}`));
})();
