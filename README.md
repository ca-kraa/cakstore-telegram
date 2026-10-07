# Cakstore Telegram Bot Gateway & Customer Support Inbox

A standalone Telegram Bot Gateway and Customer Support Inbox built for Cakstore.

This service receives incoming customer messages via Telegram Bot API Long Polling (`getUpdates`), manages customer conversations across **BOT**, **HUMAN**, and **CLOSED** modes, broadcasts live updates via WebSockets, and provides a 3-column desktop and mobile-responsive Customer Support Inbox for operators to reply directly to individual Telegram users.

---

## Features

- **Telegram Bot Gateway (Long Polling)**:
  - Uses `getUpdates` with configurable long-polling timeout (default: 30s).
  - No Telegram webhooks required.
  - Automatic error recovery and exponential backoff retry.
  - Single active polling consumer per configured bot instance.
  - Startup lifecycle: token validation, `getMe` verification, `deleteWebhook` check, and offset resumption from database.

- **Conversation & State Management**:
  - **BOT Mode**: Automated deterministic responses for standard commands (`/start`, `/help`) and inquiry routing.
  - **HUMAN Mode (Human Takeover)**: Triggered when customer sends `/admin`, `"admin"`, or `"human"`, or when admin clicks **Take Over** in the UI. Automated bot responses stop immediately; incoming messages are stored and flagged for operator attention.
  - **CLOSED Mode**: Closed support sessions with 1-click reopen capability.
  - Statuses: `OPEN`, `WAITING`, `CLOSED`.
  - Unread message tracking and automatic mark-as-read persistence.

- **Telegram Deep Linking & Referrals**:
  - Supports `/start <parameter>` deep links (e.g. `/start order_CKS123ABC`).
  - Records deep link events, associates with user conversation, and notifies the Cakstore marketplace integration API asynchronously.
  - Deep link reference visible in customer details panel with 1-click copy.

- **Customer Support Web Inbox**:
  - 3-column desktop layout (Conversation List, Active Chat, Customer Details Panel).
  - Full mobile responsiveness (Conversation list -> Chat screen with back button, slide-over details drawer).
  - Realtime WebSocket updates for incoming messages, conversation ranking, and read states.
  - Debounced multi-field search across display names, usernames, Telegram user IDs, chat IDs, and message texts.
  - Status & mode filter tabs (All, Human, Bot, Closed).
  - Clean message composer with Enter-to-send, Shift+Enter newline, loading spinners, and error retries.
  - No emojis in the interface; styled with Lucide icons.

- **Cakstore REST API**:
  - Clean server-to-server API endpoints for conversation retrieval, messaging, and status inspection.
  - Protected with `APP_API_KEY` authentication.
  - Telegram Bot Token remains exclusively server-side.

---

## Architecture Overview

```
Customer (Telegram)
        │
        ▼ (getUpdates Long Polling)
┌─────────────────────────────────────────────────────────────┐
│ cakstore-telegram Server                                    │
│                                                             │
│  TelegramPollingService ──▶ UpdateProcessor                │
│                                   │                         │
│  BotRuleEngine ◀──────────────────┤                         │
│  DeepLinkService ─────────────────┤                         │
│                                   ▼                         │
│                         ConversationService                 │
│                         MessageService                      │
│                                   │                         │
│                                   ▼                         │
│                              Database                       │
│                         (SQLite / PostgreSQL)               │
│                                   │                         │
│  RealtimeService (WebSocket) ◀────┘                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ (WebSocket & REST API)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Admin Inbox UI (React + Tailwind + Lucide Icons)            │
│                                                             │
│  [ Conversation List ]  [ Chat View ]  [ Customer Details ] │
│                                                             │
│  Admin replies ──▶ POST /api/v1/conversations/:id/messages  │
│                           │                                 │
│                           ▼                                 │
│                TelegramClient.sendMessage                   │
│                           │                                 │
│                           ▼                                 │
│                   Customer (Telegram)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listening port | `58421` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather | *(Required for live polling)* |
| `TELEGRAM_BOT_USERNAME` | Telegram bot username | `""` |
| `POLLING_TIMEOUT` | Long polling timeout in seconds | `30` |
| `DATABASE_URL` | Prisma database connection string | `file:./dev.db` |
| `APP_API_KEY` | API Key for protecting REST endpoints | `cakstore_secret_dev_key_2026` |
| `CAKSTORE_API_URL` | Cakstore marketplace webhook URL for deep link notifications | `""` |
| `CAKSTORE_API_KEY` | Bearer token / API key for Cakstore API calls | `""` |

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npx prisma db push
```

3. Configure environment in `.env`:
```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_BOT_USERNAME="your_bot_username"
POLLING_TIMEOUT=30
DATABASE_URL="file:./dev.db"
APP_API_KEY="cakstore_secret_dev_key_2026"
```

4. Start development mode:
```bash
# Starts both the backend server and Vite client
npm run dev
```

The web inbox will be available at `http://localhost:58420` (proxied to server at `http://localhost:58421`).

---

## Production Build & Run

```bash
# Build frontend and compile TypeScript backend
npm run build

# Start production server
npm start
```

Access the inbox directly at `http://localhost:58421`.

---

## Testing

Run unit and integration tests:

```bash
npm test
```

---

## REST API Reference

All `/api/v1` endpoints support authentication via header `X-API-Key: <APP_API_KEY>` or `Authorization: Bearer <APP_API_KEY>`.

### Health & Telegram Gateway Status
- `GET /api/v1/health` - Check API and server health.
- `GET /api/v1/telegram/status` - View bot gateway state, uptime, connection status, and last update offset.
- `POST /api/v1/telegram/restart` - Restart the polling service.

### Conversations
- `GET /api/v1/conversations?search=&mode=&status=` - List conversations with optional filtering.
- `GET /api/v1/conversations/:id` - Get details of a specific conversation.
- `GET /api/v1/conversations/:id/messages` - Get all messages for a conversation.
- `POST /api/v1/conversations/:id/messages` - Send an admin reply to the customer's Telegram chat.
  ```json
  {
    "text": "Hello, how can I assist you today?"
  }
  ```
- `POST /api/v1/conversations/:id/mode` - Switch conversation mode (`BOT`, `HUMAN`, `CLOSED`).
  ```json
  {
    "mode": "HUMAN"
  }
  ```
- `POST /api/v1/conversations/:id/status` - Switch conversation status (`OPEN`, `WAITING`, `CLOSED`).
- `POST /api/v1/conversations/:id/read` - Mark conversation unread count as 0.

### Deep Links / Referrals
- `GET /api/v1/bot/deep-link?parameter=&userId=` - Query deep link events received by the bot.
