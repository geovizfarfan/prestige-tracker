const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

if (!c.includes('bountyButtonHandler')) {
  c = c.replace(
    "const { handleButton } = require('./interactions/buttonHandler');",
    "const { handleButton } = require('./interactions/buttonHandler');\nconst { handleBountyButton, handleBountyModal } = require('./interactions/bountyButtonHandler');"
  );

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

  fs.writeFileSync('src/index.js', c);
  console.log('Bounty handlers wired into index.js');
} else {
  console.log('Already wired');
}
