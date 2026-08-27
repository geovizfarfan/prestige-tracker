const fs = require('fs');

// Fix tracker patterns
let t = fs.readFileSync('src/games/hangryGamesTracker.js', 'utf8');

// Fix remaining count - also handle "hangry people remaining"
t = t.replace(
  "const match = text.match(/(\\d+)\\s+(?:picnic\\s+goers?|hangry\\s+people?)\\s+remaining/i);",
  "const match = text.match(/(\\d+)\\s+(?:picnic\\s+goers?|hangry\\s+people?|people?)\\s+remaining/i);"
);

// Fix winner pattern - handle unicode server name
t = t.replace(
  "const patterns = [\n    /\\*\\*(.+?)\\*\\*\\s+won\\s+THE\\s+BOARD\\s+PRINCESS/i,\n    /🎉\\s+\\*(.+?)\\*\\s+won/i,\n    /🎊\\s+\\*\\*(.+?)\\*\\*\\s+won/i,\n    /(.+?)\\s+won\\s+THE\\s+BOARD\\s+PRINCESS/i,\n  ];",
  `const patterns = [
    /\\*\\*(.+?)\\*\\*\\s+won\\s+(?:THE\\s+BOARD\\s+PRINCESS|𝚃𝙷𝙴\\s+𝙱𝙾𝙰𝚁𝙳\\s+𝙿𝚁𝙸𝙽𝙲𝙴𝚂𝚂)/i,
    /🎉\\s+\\*\\*(.+?)\\*\\*\\s+won/i,
    /🎊\\s+\\*\\*(.+?)\\*\\*\\s+won/i,
    /\\*(.+?)\\*\\s+won\\s+(?:THE\\s+BOARD\\s+PRINCESS|𝚃𝙷𝙴)/i,
    /(.+?)\\s+won\\s+(?:THE\\s+BOARD\\s+PRINCESS|𝚃𝙷𝙴\\s+𝙱𝙾𝙰𝚁𝙳)/i,
  ];`
);

fs.writeFileSync('src/games/hangryGamesTracker.js', t);

// Fix handler patterns
let h = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Fix kill detection - crossedswords emoji ID
h = h.replace(
  "const hasSword = fullText.includes('⚔') || fullText.includes('✂️') || /^[⚔✂]/.test(fullText.trim());",
  "const hasSword = fullText.includes('⚔') || fullText.includes('✂️') || fullText.includes('crossedswords') || fullText.includes(':knife:') || /^[⚔✂]/.test(fullText.trim());"
);

// Fix suicide detection - "A body was found" variant
h = h.replace(
  "if (fullText.includes('A half-eaten sandwich was found!') || fullText.includes('A body was found') || fullText.includes('🥪')) {",
  "if (fullText.includes('A half-eaten sandwich was found') || fullText.includes('A body was found') || fullText.includes('🥪') || fullText.includes(':knife: A body')) {"
);

// Fix winner detection - handle unicode server name
h = h.replace(
  "if ((fullText.includes('won THE BOARD PRINCESS') && fullText.includes('Hangry Games')) ||\n      fullText.includes('Winner!') && fullText.includes('Hangry Games')) {",
  "if ((fullText.includes('won') && fullText.includes('Hangry Games')) || (fullText.includes('Winner') && fullText.includes('Hangry Games'))) {"
);

// Fix game start detection
h = h.replace(
  "const isGameStart = fullText.includes(\"has started THE BOARD PRINCESS's\") ||\n    fullText.includes('The Battle Begins') ||\n    (fullText.includes('tributes') && fullText.includes('Hangry Games'));",
  `const isGameStart = fullText.includes("has started") && fullText.includes('Hangry Games') ||
    fullText.includes('The Battle Begins') ||
    (fullText.includes('tributes') && fullText.includes('Hangry Games')) ||
    (fullText.includes('Part 2') && fullText.includes('Battle'));`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', h);
console.log('Patterns fixed');
