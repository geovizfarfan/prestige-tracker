# ✨ Prestige Tracker — Discord Bot

Team-based scorekeeping bot built with Discord.js v14 + better-sqlite3.

---

## 📁 Project Structure

```
prestige-tracker/
├── src/
│   ├── index.js                  ← Bot entry point
│   ├── deploy-commands.js        ← Register slash commands
│   ├── db/
│   │   └── database.js           ← SQLite schema + all queries
│   ├── commands/
│   │   ├── game/
│   │   │   ├── game-start.js     ← /game-start
│   │   │   ├── game-end.js       ← /game-end
│   │   │   ├── game-cancel.js    ← /game-cancel
│   │   │   ├── session-info.js   ← /session-info
│   │   │   └── set-dates.js      ← /set-start-date, /set-end-date
│   │   ├── score/
│   │   │   └── score.js          ← /score-add, /score-remove, /team-score-add, /team-score-remove
│   │   └── admin/
│   │       ├── member-admin.js   ← /member-add, /member-remove, /member-move, /member-info, /member-list
│   │       └── owner-commands.js ← /bot-reset, /scoreboard-post, /history, /leaderboard
│   ├── interactions/
│   │   └── buttonHandler.js      ← All button click logic
│   └── utils/
│       ├── embeds.js             ← All Discord embeds + UI builders
│       ├── randomizer.js         ← Team assignment logic
│       ├── permissions.js        ← Owner/Admin checks
│       └── scoreboardUpdater.js  ← Live scoreboard auto-updater
├── data/                         ← SQLite DB file lives here (auto-created)
├── .env.example
└── package.json
```

---

## 🚀 Setup

### 1. Prerequisites
- Node.js v18+
- A Discord Application & Bot token from https://discord.com/developers

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env` and fill in:
```
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_server_guild_id
OWNER_ID=your_discord_user_id
```

- **DISCORD_TOKEN** — Bot token from the Discord Developer Portal
- **CLIENT_ID** — Your application's ID (OAuth2 → General page)
- **GUILD_ID** — Right-click your server → Copy Server ID (enable Developer Mode first)
- **OWNER_ID** — Your own Discord user ID (right-click yourself → Copy User ID)

### 4. Bot permissions
When inviting your bot, ensure it has:
- `Manage Roles` (to create/assign team roles)
- `Send Messages`
- `Embed Links`
- `Use Application Commands`

> **Important:** Your bot's role must be **higher** in the role list than the team roles it creates.

### 5. Deploy slash commands
```bash
npm run deploy
```

### 6. Start the bot
```bash
npm start
```

---

## 🎮 Command Reference

### Game / Session Commands

| Command | Permission | Description |
|---|---|---|
| `/game-start` | Admin | Start a new session, open signups |
| `/game-end` | Admin | End session, show winners, log history |
| `/game-cancel` | Admin | Cancel session without saving history |
| `/session-info` | Everyone | Show current session details |
| `/set-start-date` | Admin | Set session start date (YYYY-MM-DD) |
| `/set-end-date` | Admin | Set session end date (YYYY-MM-DD) |

### Score Commands

| Command | Permission | Description |
|---|---|---|
| `/score-add` | Admin | Add points to a member |
| `/score-remove` | Admin | Remove points from a member |
| `/team-score-add` | Admin | Add bonus points to a team directly |
| `/team-score-remove` | Admin | Remove bonus points from a team |

### Member Management

| Command | Permission | Description |
|---|---|---|
| `/member-add` | Admin | Manually add a member (if button fails) |
| `/member-remove` | Admin | Remove a member from the session |
| `/member-move` | Admin | Move a member to another team |
| `/member-info` | Everyone | View a member's team and score |
| `/member-list` | Everyone | List all members per team |

### Info & Leaderboards

| Command | Permission | Description |
|---|---|---|
| `/leaderboard` | Everyone | Team or member leaderboard |
| `/history` | Everyone | View past session results |
| `/scoreboard-post` | Admin | Post live scoreboard in current channel |

### Owner Only

| Command | Permission | Description |
|---|---|---|
| `/bot-reset` | Owner | Fully wipe all data (requires confirmation) |

---

## 🔄 Typical Game Flow

```
1. Admin runs /game-start
   → Signup embed posted with ✨ Join / ▶ Start / ✖ Cancel buttons

2. Members click ✨ Join to sign up

3. Admin clicks ▶ Start
   → Bot randomly assigns members to teams (balanced)
   → Team roles created and assigned in Discord
   → Team Sessions embed posted with 🚪 Join Late button

4. Admin runs /scoreboard-post in a dedicated channel
   → Live scoreboard posted, auto-updates on every score change

5. Admins run /score-add during the game to award points
   → Member's score updates → team total updates → scoreboard refreshes

6. Admin runs /game-end
   → Winner announced, history saved, roles cleaned up
```

---

## 🗄️ Database Schema

All data stored in `data/prestige.db` (SQLite, persists across restarts):

- **sessions** — Active/past game sessions
- **teams** — Teams per session with role IDs and total scores
- **members** — Players assigned to teams with individual scores
- **signups** — Pre-assignment signup queue
- **session_history** — Completed game records with winners/MVPs
- **score_log** — Audit trail of every point change

---

## ⚙️ Options for /game-start

```
/game-start name:"Summer Cup" teams:4
/game-start name:"Custom Teams" team_names:"Fire,Ice,Storm,Shadow"
```

- `name` — Session display name (default: Season 1)
- `teams` — Number of teams, 2–10 (default: 4)
- `team_names` — Comma-separated custom names (overrides teams count)

---

## 💡 Tips

- Post the scoreboard in a read-only **#scoreboard** channel for best UX
- The live scoreboard auto-updates every time points are added/removed
- Late joiners are auto-balanced to the smallest team
- Use `/member-add` as a fallback if the Join button fails for someone
- Session history is saved permanently — use `/history` to review past games
