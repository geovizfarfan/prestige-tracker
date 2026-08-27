const fs = require('fs');
let c = fs.readFileSync('src/commands/bounties/addbounty.js', 'utf8');

// Add defer at the start of execute
if (!c.includes('deferReply')) {
  c = c.replace(
    '  async execute(interaction) {\n    const guildId = interaction.guildId;',
    '  async execute(interaction) {\n    await interaction.deferReply({ ephemeral: true });\n    const guildId = interaction.guildId;'
  );
  
  // Change all interaction.reply to interaction.editReply
  c = c.replaceAll('return interaction.reply({', 'return interaction.editReply({');
  c = c.replaceAll('await interaction.reply({', 'await interaction.editReply({');
  
  fs.writeFileSync('src/commands/bounties/addbounty.js', c);
  console.log('Defer added');
} else {
  console.log('Already deferred');
}
