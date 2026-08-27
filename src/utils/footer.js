// src/utils/footer.js
// Returns consistent footer text using server name + bot name

function getFooter(guildOrName) {
  const name = typeof guildOrName === 'string' ? guildOrName : guildOrName?.name;
  return name ? `${name} • Orbit Tracker` : 'Orbit Tracker';
}

module.exports = { getFooter };
