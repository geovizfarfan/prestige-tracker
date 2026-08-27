const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

if (!c.includes('isAutocomplete')) {
  c = c.replace(
    "if (interaction.isChatInputCommand()) {",
    `if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) await command.autocomplete(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {`
  );
  fs.writeFileSync('src/index.js', c);
  console.log('Autocomplete handler added');
} else {
  console.log('Already present');
}
