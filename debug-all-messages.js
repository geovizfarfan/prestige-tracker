const fs = require('fs');
let c = fs.readFileSync('src/index.js', 'utf8');

if (!c.includes('ALL_MSG_DEBUG')) {
  c = c.replace(
    "client.on('messageCreate', async message => {",
    `client.on('messageCreate', async message => {
  if (message.guild) {
    console.log('[ALL MSG]', message.author.id, message.author.username, '| channel:', message.channelId, '| embeds:', message.embeds.length, '| content:', message.content?.slice(0,30) || '(empty)');
  } // ALL_MSG_DEBUG`
  );
  fs.writeFileSync('src/index.js', c);
  console.log('done');
} else {
  console.log('already added');
}
