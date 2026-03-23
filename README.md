# Contexta ✨

Contexta is an AI-powered Discord bot built with TypeScript, `discord.js`, and Google's Gemini API. It leverages PostgreSQL (with pgvector) for long-term memory and persistent storage, and Redis for short-term caching to deliver context-aware, intelligent interactions in your Discord server.

## Features
- **AI-Powered Responses**: Integrated with Google's Gemini API for highly intelligent and native conversational capabilities.
- **Context-Aware Memory**: Uses PostgreSQL and `pgvector` to store and retrieve semantic embeddings, giving the bot "long-term memory" of channel context and past conversations.
- **High-Performance Caching**: Utilizes Redis for fast, short-term data lookups and state management.
- **TypeScript & ES Modules**: Built with modern TypeScript and ESM for robust, typed, and maintainable code.

## Context & Memory Architecture
Contexta uses a multi-tiered memory system to provide native, intelligent responses:
- **Server Lore (Context Caching)**: Overarching server rules and global context are stored and optionally cached via the Gemini Context Caching API for lower latency and efficient token usage.
- **User Profiles**: The bot infers and builds personalized context and preferences (stored as JSONB) for individual users based on their unique interactions.
- **Semantic Channel Memory**: Past conversations are chunked, summarized, and stored as vector embeddings using PostgreSQL and `pgvector`. This allows the bot to perform similarity searches and organically weave relevant past context into current replies.

## Prerequisites
To run this bot, you will need:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Discord Bot Token (from the [Discord Developer Portal](https://discord.com/developers/applications))
- A Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))
- A PostgreSQL database (with `pgvector` extension enabled)
- A Redis instance

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd contexta
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your actual API keys and database connections inside the `.env` file. Do NOT commit your `.env` file!

   Variables required:
   - `DISCORD_TOKEN`: Your Discord bot token.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `DATABASE_URL`: Connection string for your PostgreSQL database.
   - `REDIS_URL`: Connection string for your Redis instance.
   - `DEFAULT_SERVER_ID`: Discord Server ID for background optimization tasks.

## Usage

### Development Mode
To run the bot in development mode with hot-reloading (using `tsx`):
```bash
npm run dev
```

### Production Mode
To build the TypeScript files and run the compiled JavaScript:
```bash
# Compile TypeScript to JavaScript in the dist/ directory
npm run build

# Start the bot
npm start
```

## Project Structure
- `src/index.ts` - Entry point that initializes services, loads bot events, and logs into Discord.
- `src/events/` - Discord event listeners (e.g., `ready`, `messageCreate`).
- `src/utils/redis.ts` - Redis connection and initialization logic.
- `src/utils/backgroundWorker.ts` - Background worker for scanning/optimizing semantic embeddings.
- `dist/` - Compiled JavaScript output (generated after build).

## Tech Stack
- [discord.js](https://discord.js.org/) - Discord API library
- [Google GenAI API](https://ai.google.dev/) - Gemini interactions
- [PostgreSQL](https://www.postgresql.org/) & [pgvector](https://github.com/pgvector/pgvector) - Semantic memory architecture
- [Redis](https://redis.io/) - Fast caching layer
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript

## License
MIT
