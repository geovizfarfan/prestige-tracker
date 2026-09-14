// src/clear-guild-commands.js
//
// One-off cleanup: wipes GUILD-scoped slash commands from every guild the
// bot is in, leaving only the global commands (deploy-commands.js) in
// place. Fixes duplicate entries in Discord's slash command picker caused
// by having both global and guild-scoped versions of the same commands
// registered simultaneously.
//
// Run once with the same env vars as the bot itself:
//   node src/clear-guild-commands.js
//
// Safe to run more than once — clearing an already-empty guild command
// list is a no-op.

require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Fetching guilds the bot is in...');
    const guilds = await rest.get(Routes.userGuilds());
    console.log(`Found ${guilds.length} guild(s):`, guilds.map(g => `${g.name} (${g.id})`).join(', '));

    for (const guild of guilds) {
      console.log(`Clearing guild-scoped commands for ${guild.name} (${guild.id})...`);
      const existing = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id));
      if (!existing.length) {
        console.log(`  → already clean, nothing to remove.`);
        continue;
      }
      console.log(`  → removing ${existing.length} guild-scoped command(s): ${existing.map(c => '/' + c.name).join(', ')}`);
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id), { body: [] });
      console.log(`  ✅ cleared.`);
    }

    console.log('\nDone. Global commands (from deploy-commands.js) are untouched — only guild-scoped duplicates were removed.');
  } catch (error) {
    console.error('[Guild Command Cleanup Failed]', {
      code: error.code,
      status: error.status,
      message: error.message,
      validation: error.rawError?.errors || null,
    });
    process.exitCode = 1;
  }
})();
