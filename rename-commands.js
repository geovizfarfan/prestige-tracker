const fs = require('fs');
const path = require('path');

const gameDir = path.join('src', 'commands', 'game');
const renames = {
  'game-start.js': ['game-start', 'team-start'],
  'game-end.js': ['game-end', 'team-end'],
  'game-cancel.js': ['game-cancel', 'team-cancel'],
  'post-teams.js': ['post-teams', 'team-repost'],
};

for (const [filename, [oldName, newName]] of Object.entries(renames)) {
  const oldPath = path.join(gameDir, filename);
  const newFilename = filename.replace(oldName.replace('post-teams', 'post-teams'), newName) + (filename.endsWith('.js') ? '' : '.js');
  const newPath = path.join(gameDir, newName + '.js');
  if (fs.existsSync(oldPath)) {
    let c = fs.readFileSync(oldPath, 'utf8');
    c = c.replace(`'${oldName}'`, `'${newName}'`);
    fs.writeFileSync(newPath, c);
    if (oldPath !== newPath) fs.unlinkSync(oldPath);
    console.log(`✅ ${oldName} → ${newName}`);
  } else {
    console.log(`⚠️ Not found: ${oldPath}`);
  }
}

// Rename hangry-game command to game-recap
const hangryCmd = path.join('src', 'commands', 'games', 'hangry-commands.js');
if (fs.existsSync(hangryCmd)) {
  let c = fs.readFileSync(hangryCmd, 'utf8');
  c = c.replace(".setName('hangry-game')", ".setName('game-recap')");
  c = c.replace("'Show recap of a specific Hangry Games match'", "'Show recap of a specific Hangry Games match (by game number)'");
  fs.writeFileSync(hangryCmd, c);
  console.log('✅ hangry-game → game-recap');
}

console.log('Done!');
