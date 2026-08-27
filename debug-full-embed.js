const fs = require('fs');
let c = fs.readFileSync('src/games/hangryGamesHandler.js', 'utf8');

// Replace existing empty embed debug with full raw embed log
c = c.replace(
  'if (!fullText.trim()) { if (message.embeds.length) console.log("[Hangry] Empty embed struct:", JSON.stringify(message.embeds[0]).slice(0,300)); return; }',
  `if (!fullText.trim()) { 
    if (message.embeds.length) {
      const e = message.embeds[0];
      console.log("[Hangry] RAW EMBED keys:", Object.keys(e.data || e));
      console.log("[Hangry] RAW EMBED data:", JSON.stringify(e.data || e).slice(0,500));
    }
    return; 
  }`
);

fs.writeFileSync('src/games/hangryGamesHandler.js', c);
console.log('done');
