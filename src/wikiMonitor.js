const WIKI_GUILD_ID        = '1506048817471160320';
const WIKI_DAILY_CHANNEL   = '1506055376741728326';
const WIKI_REWARDS_CHANNEL = '1506055339466952815';

const TYPE_TO_COL = {
  flashevents: 'wiki_flashevents_channel_id',
  tournaments: 'wiki_tournaments_channel_id',
  dicelinks:   'wiki_dicelinks_channel_id',
};

// Custom number emojis
const NUM_EMOJIS = {
  '0': '<:0_:1508891976618213497>',
  '1': '<:1_:1508891978681548801>',
  '2': '<:2_:1508891979365351575>',
  '3': '<:3_:1508891980271452280>',
  '4': '<:4_:1508891981126828123>',
  '5': '<:5_:1508891982041448579>',
  '6': '<:6_:1508891983626637462>',
  '7': '<:7_:1508891984532602890>',
  '8': '<:8_:1508891985480515605>',
  '9': '<:9_:1508891986290278480>',
};

function numToEmoji(n) {
  return String(n).split('').map(d => NUM_EMOJIS[d] || d).join('');
}

// Flash event emojis — ordered longest key first to avoid partial matches
const EVENT_EMOJIS = [
  ['free parking dice',  '<:Free_Parking_Dice_TBP:1479330414664482836>'],
  ['free parking cash',  '<:Free_Parking_Cash_TBP:1479330413347340331>'],
  ['free parking',       '<:Free_Parking_Dice_TBP:1479330414664482836>'],
  ['adventure club',     '<:adventureclub:1508886290265804871>'],
  ['sticker boom',       '<:Sticker_Boom_TBP:1479330448105672805>'],
  ['lucky chance',       '<:Lucky_Chance_TBP:1479330426009944105>'],
  ['roll match',         '<:Roll_Match_TBP:1479330447023407115>'],
  ['rent frenzy',        '<:Rent_Frenzy_TBP:1479330445421449319>'],
  ['cash grab',          '<:Cash_Grab_TBP:1479330406758092830>'],
  ['cash boost',         '<:Cash_Boost_TBP:1479330405642535068>'],
  ['high roller',        '<:High_Roller_TBP:1479330421014794371>'],
  ['golden blitz',       '<:Golden_Blitz_TBP:1479330416593862737>'],
  ['jackpot',            '<:Jackpot_Stack_TBP:1479330422121959454>'],
  ['juggler',            '<:Juggler_Token_TBP:1479330424609181818>'],
  ['builder',            '<:Builder_Bash:1479330398860476447>'],
  ['racers',             '<:Racers_Flag_TBP:1479330441952628880>'],
  ['partner',            '<:Partner_Carry_Token:1479330433278803978>'],
  ['peg',                '<:Peg_E_Token_TBP:1479330434801209384>'],
  ['dig',                '<:dig:1508886816441499658>'],
  ['mega heist',         '<:megaheist:1508894387051171970>'],
  ['shutdown',           '💥'],
  ['bank heist',         '🏦'],
  ['wheel boost',        '🎡'],
  ['board rush',         '🏃'],
  ['landmark rush',      '🏛️'],
];

function getEventEmoji(name) {
  const lower = name.toLowerCase();
  for (const [key, emoji] of EVENT_EMOJIS) {
    if (lower.includes(key)) return emoji;
  }
  return '•';
}

const SPARKLE  = '<a:sparkle:1508886291687805128>';
const CLOCK    = '<a:clock:1508890542396801196>';
const BULLET   = '<:bullet:1508886288726622288>';
const DICEROLL = '<a:diceroll:1508888618196799538>';
const ARROW    = '<a:arrow:1508888585598931065>';
const ALARM    = '<a:4420alarm1:1508890151093407764>';

function cleanName(line) {
  return line
    .replace(/^[\s\u00A0\u200B-\u200D\uFEFF]*/g, '')
    .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}]+/gu, '')
    .replace(/^[\s\u2022\u00B7\-\u2013\u2014]+/, '')
    .trim();
}

function formatDateHeader(dateStr) {
  const match = dateStr.match(/(\w+)\s+(\d+)(?:st|nd|rd|th)?,?\s*(\d{4})/i);
  if (!match) return dateStr;
  return `${SPARKLE} ${match[1]} ${parseInt(match[2])}, ${match[3]} ${SPARKLE}`;
}

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseTimeToUnix(timeStr, baseDate) {
  timeStr = (timeStr || '').trim();

  const full = timeStr.match(/(\d+)\s+(\w+)\s+(\d{4})\s+at\s+(\d+):(\d+)\s*(am|pm)/i);
  if (full) {
    let h = parseInt(full[4]);
    if (full[6].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (full[6].toLowerCase() === 'am' && h === 12) h = 0;
    return Math.floor(new Date(Date.UTC(
      parseInt(full[3]), MONTHS[full[2].toLowerCase().slice(0,3)],
      parseInt(full[1]), h, parseInt(full[5])
    )).getTime() / 1000);
  }

  const t = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (t && baseDate) {
    let h = parseInt(t[1]);
    if (t[3].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (t[3].toLowerCase() === 'am' && h === 12) h = 0;
    const d = new Date(baseDate);
    d.setUTCHours(h, parseInt(t[2]), 0, 0);
    return Math.floor(d.getTime() / 1000);
  }
  return null;
}

function parseDailyEvents(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let dateHeader = '', baseDate = null;

  const titleMatch = content.match(/Daily Events for ([^\]]+)\]/i);
  if (titleMatch) {
    dateHeader = formatDateHeader(titleMatch[1]);
    const dm = titleMatch[1].match(/(\w+)\s+(\d+)(?:st|nd|rd|th)?,?\s*(\d{4})/i);
    if (dm) {
      baseDate = new Date(Date.UTC(
        parseInt(dm[3]), MONTHS[dm[1].toLowerCase().slice(0,3)], parseInt(dm[2])
      ));
    }
  }

  const tournaments = [], flashEvents = [];
  let section = null, current = null;

  for (const line of lines) {
    const clean = cleanName(line);
    if (!clean) continue;

    if (/^tournaments$/i.test(clean))                                      { section = 'tournaments'; continue; }
    if (/^special events$/i.test(clean) || /^flash events$/i.test(clean)) { section = 'flash'; continue; }
    if (!section) continue;
    if (/^here's|^daily events|monopolygo\.wiki/i.test(clean)) continue;

    const dur = clean.match(/^Duration window:\s*(.+)$/i);
    const tr  = clean.match(/^(\d+:\d+\s*(?:am|pm))\s*[–\-]\s*(.+)$/i);

    if (dur && current) { current.duration = dur[1]; continue; }

    if (tr) {
      if (current) {
        const s = parseTimeToUnix(tr[1], baseDate);
        const e = parseTimeToUnix(tr[2], baseDate);
        current.start = s ? `<t:${s}:t>` : tr[1];
        current.end   = e ? `<t:${e}:F>` : tr[2];
        if (section === 'tournaments') { tournaments.push(current); current = null; }
      }
      continue;
    }

    if (section === 'tournaments') {
      if (current) tournaments.push(current);
      current = { name: clean };
    } else if (section === 'flash') {
      if (current) flashEvents.push(current);
      current = { name: clean, duration: null };
    }
  }
  if (current && section === 'flash') flashEvents.push(current);
  if (current && section === 'tournaments') tournaments.push(current);

  return { dateHeader, tournaments, flashEvents };
}

function buildFlashEventsMessage(dateHeader, flashEvents) {
  const lines = [dateHeader, ''];
  for (const ev of flashEvents) {
    lines.push(`${getEventEmoji(ev.name)} **${ev.name}**`);
    if (ev.start && ev.end) lines.push(`${ev.start}  until  ${ev.end}`);
    if (ev.duration) lines.push(`${CLOCK} **Duration:** ${ev.duration}`);
    lines.push('');
  }
  return lines.join('\n');
}

function buildTournamentsMessage(dateHeader, tournaments) {
  const lines = [`## ${dateHeader}`, ''];
  tournaments.forEach((t, i) => {
    const dashMatch = t.name.match(/^(.+?)\s*[—\-]\s*(.+)$/);
    const eventName = dashMatch ? dashMatch[1].trim() : t.name;
    const subtype   = dashMatch ? dashMatch[2].trim() : '';
    const label     = i === 0 ? 'Top Tournament' : 'Side Tournament';

    lines.push(`### ${BULLET}  ${label}`);
    lines.push(`-# **${eventName}**${subtype ? ` — ${subtype}` : ''}`);
    if (t.start) lines.push(`-# **__Starts:__** ${t.start}`);
    if (t.end)   lines.push(`-# **__Ends:__** ${t.end}`);
    lines.push('');
  });
  return lines.join('\n');
}

function buildDiceLinkMessage(content) {
  const diceMatch = content.match(/Reward:\s*(\d+)\s*Dice/i);
  const linkMatch = content.match(/https?:\/\/[^\s)]+/);
  const expMatch  = content.match(/Expires:\s*([^(\n]+)/i);

  const dice = diceMatch ? diceMatch[1] : '??';
  const link = linkMatch ? linkMatch[0] : '';
  const exp  = expMatch  ? expMatch[1].trim() : '';

  const expTs = parseTimeToUnix(exp, null);
  const expFormatted = expTs ? `<t:${expTs}:F>` : exp;

  return `## ${DICEROLL} ${numToEmoji(dice)} ${DICEROLL}\n${ARROW} ${link}\n${ALARM} ${expFormatted}`;
}

async function repostToGuilds(client, pgQuery, type, messageContent, attachments = []) {
  const col = TYPE_TO_COL[type];
  if (!col) return;

  const result = await pgQuery(
    `SELECT guild_id, ${col} AS channel_id FROM guild_settings WHERE ${col} IS NOT NULL`
  );

  for (const row of result.rows) {
    try {
      const channel = await client.channels.fetch(row.channel_id).catch(() => null);
      if (!channel) continue;

      const payload = { content: messageContent };

      if (attachments.length > 0) {
        const { AttachmentBuilder } = require('discord.js');
        const files = [];
        for (const att of attachments) {
          try {
            const res = await globalThis.fetch(att.url);
            const buf = Buffer.from(await res.arrayBuffer());
            files.push(new AttachmentBuilder(buf, { name: att.name || 'image.png' }));
          } catch {}
        }
        if (files.length) payload.files = files;
      }

      await channel.send(payload);
      console.log(`✅ Reposted ${type} to guild ${row.guild_id}`);
    } catch (err) {
      console.error(`Wiki repost failed for guild ${row.guild_id}:`, err.message);
    }
  }
}

function setupWikiMonitor(client, pgQuery) {
  client.on('messageCreate', async message => {
    try {
      if (message.guildId !== WIKI_GUILD_ID) return;
      if (message.channelId !== WIKI_DAILY_CHANNEL && message.channelId !== WIKI_REWARDS_CHANNEL) return;
      if (!message.author.bot && !message.webhookId) return;

      const content = message.content || '';
      const attachments = [...message.attachments.values()];

      console.log(`📡 Wiki message in ${message.channelId}: "${content.slice(0, 80)}"`);

      if (message.channelId === WIKI_REWARDS_CHANNEL) {
        if (/dice/i.test(content)) {
          await repostToGuilds(client, pgQuery, 'dicelinks', buildDiceLinkMessage(content), attachments);
        }
        return;
      }

      if (/daily events|tournament|special event/i.test(content)) {
        const { dateHeader, tournaments, flashEvents } = parseDailyEvents(content);
        if (flashEvents.length > 0) {
          await repostToGuilds(client, pgQuery, 'flashevents', buildFlashEventsMessage(dateHeader, flashEvents));
        }
        if (tournaments.length > 0) {
          await repostToGuilds(client, pgQuery, 'tournaments', buildTournamentsMessage(dateHeader, tournaments), attachments);
        }
      }

    } catch (err) {
      console.error('Wiki monitor error:', err.message);
    }
  });

  console.log('📡 Wiki monitor active');
}

module.exports = { setupWikiMonitor };
