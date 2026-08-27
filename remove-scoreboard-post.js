const fs = require('fs');
let c = fs.readFileSync('src/commands/admin/owner-commands.js', 'utf8');

// Find and remove the scoreboard-post command block
const start = c.indexOf("  {\n    data: new SlashCommandBuilder()\n      .setName('scoreboard-post')");
if (start === -1) { console.log('Not found'); process.exit(0); }

const end = c.indexOf('  },\n  {', start) + 4;
c = c.slice(0, start) + c.slice(end);
fs.writeFileSync('src/commands/admin/owner-commands.js', c);
console.log('done');
