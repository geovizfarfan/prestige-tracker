const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Remove the bot ID check - just check channel + content patterns
c = c.replace(
  /\/\/ Check registered bot IDs[\s\S]*?if \(!botIds\.includes\(message\.author\.id\)\) return;\n/m,
  '// Any bot can post Hangry Games content - we filter by content patterns instead\n'
);

// Also remove old single ID check if present
c = c.replace(
  /.*if \(message\.author\.id !== tracker\.PIXXIEBOT_ID\) return;\n/m,
  '// Bot ID check removed - filtering by content patterns only\n'
);

// Remove old debug line about msg from if still there
c = c.replace(
  /.*console\.log\("\[Hangry\] msg from:".*\n/m,
  ''
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
