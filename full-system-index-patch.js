const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

// Add imports
if (!c.includes('bountyButtonHandler')) {
  c = c.replace(
    "const { handleButton } = require('./interactions/buttonHandler');",
    `const { handleButton } = require('./interactions/buttonHandler');
const { handleBountyButton, handleBountyModal } = require('./interactions/bountyButtonHandler');
const { handlePixxieBotMessage } = require('./games/hangryGamesHandler');`
  );
}

// Add MessageContent intent
if (!c.includes('MessageContent')) {
  c = c.replace(
    'GatewayIntentBits.GuildMessages,',
    'GatewayIntentBits.GuildMessages,\n    GatewayIntentBits.MessageContent,'
  );
}

// Add autocomplete handler
if (!c.includes('isAutocomplete')) {
  c = c.replace(
    "if (interaction.isChatInputCommand()) {",
    `if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) await command.autocomplete(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {`
  );
}

// Add bounty button + modal routing
if (!c.includes('bounty_')) {
  c = c.replace(
    "} else if (interaction.isButton()) {\n      await handleButton(interaction);\n    }",
    `} else if (interaction.isButton()) {
      if (interaction.customId.startsWith('bounty_')) {
        await handleBountyButton(interaction);
      } else {
        await handleButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('bounty_reject_reason_')) {
        await handleBountyModal(interaction);
      }
    }`
  );
}

// Add message listener for PixxieBot
if (!c.includes('messageCreate')) {
  c = c.replace(
    "console.log('Logging in to Discord...');",
    `client.on('messageCreate', async message => {
  try { await handlePixxieBotMessage(message); }
  catch (err) { console.error('[Hangry Games]', err.message); }
});

console.log('Logging in to Discord...');`
  );
}

fs.writeFileSync('src/index.js', c);
console.log('Full system index patch applied');
