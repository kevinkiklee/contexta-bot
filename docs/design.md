# System Design Document: Contexta (Discord AI Assistant)

## 1. System Overview

Contexta is an intelligent, integrated AI assistant for Discord. Unlike simple command-response bots, this system functions as a persistent server member, capable of handling multi-turn, multi-user conversations while maintaining distinct memory streams for the server as a whole, specific channels, and individual users. It is designed to act as a reliable, always-on co-host for communities of any size.

## 2. Core Architecture & Tech Stack

  * Application Framework: Node.js with TypeScript and discord.js
  * LLM Provider: Gemini 2.5 Flash (via an internal Model Abstraction Layer)
  * Compute & Hosting: Railway (Platform-as-a-Service)
  * Primary Database & Vector Store: PostgreSQL with the pgvector extension (hosted on Railway or Neon)
  * Cache Layer: Redis (e.g., Upstash or Railway internal) for fast retrieval of immediate, short-term channel history.

## 3. Context Management Strategy

To prevent prompt bloating and manage API costs, memory is tiered and structured.

  * Server Context (Global): General rules, server lore, active events, and overarching community themes. Injected into the system prompt.
  * Channel Context (Local): The specific topic or purpose of the current channel.
  * User Context (Personal): The bot's understanding of the specific user(s) interacting with it (preferences, past interactions).
  * Short-Term Conversation Window: The last N messages in the active channel, kept in a rolling Redis cache.
  * Long-Term Recall: Triggered via semantic search (Retrieval-Augmented Generation) when a user asks the bot to recall past events or history.

## 4. Multi-User Disambiguation

When multiple users speak in the same channel, the LLM must understand the conversational dynamics. Before sending the chat array to the LLM, the TypeScript application formats the prompt to append the Discord user's display name or ID to their message.

Format Example:
[User: Alex]: What time is the event?
[User: Sarah]: I think it's at 5 PM.
[System/Bot]: Actually Alex and Sarah, the event is scheduled for 6 PM.

## 5. Model Abstraction Layer (The Adapter Pattern)

To ensure the bot remains model-agnostic, the core system does not interact directly with any specific LLM API.

  * The AI Interface: A standard interface (e.g., generateChatResponse) that the rest of the Discord bot calls.
  * Provider Classes: Specific wrapper classes for each model (e.g., GeminiProvider.ts) that implement this interface.
  * Dynamic Switching: The preferred active model is stored in the Server Settings table, allowing dynamic failover.

## 6. LLM Optimization: Gemini Context Caching

Contexta utilizes Gemini Context Caching to drastically cut API costs when injecting massive server rules and channel histories.

  * The Cache Payload: The overarching Server Context is sent to the Gemini API to generate a cached object with a Time-To-Live (TTL).
  * Dynamic Injection: For each user message, the system calls the API, passing the cached context ID alongside the dynamic Channel Context and the Redis chat window.
  * Cost Efficiency: The system pays a fraction of the cost to recall the cached memory, paying full price only for the new user messages.

## 7. Core Use Cases

  * High-Volume Community Management: Automatically answers repetitive questions based on established server lore, helping new members get answers quickly.
  * Gaming and Event Coordination: Tracks availability, sends automated reminders, and recalls previous strategies discussed days prior.
  * Collaborative Project Workspaces: Pulls from the long-term vector database to recall architectural decisions, parse snippets, and generate task lists.
  * Local Group Logistics: Tracks rolling details for upcoming trips, suggests meeting points, and maintains a running list of who is bringing what supplies.

## 8. Deployment and Infrastructure

The application is deployed on Railway, providing a unified private network for the bot, database, and cache.

  * CI/CD Pipeline: Every push to the main branch triggers an automated build and zero-downtime deployment.
  * Internal Routing: Postgres and Redis operate in the same environment as the Node instance, eliminating egress bandwidth costs and reducing latency to near zero.

## 9. Database Schema (PostgreSQL)

### Server Settings Table

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| server\_id | VARCHAR(255) | PRIMARY KEY | The unique Discord Guild ID. |
| active\_model | VARCHAR(50) | DEFAULT 'gemini-2.5-flash' | Allows dynamic model switching per server. |
| server\_lore | TEXT | NULLABLE | The core rules and overarching community themes. |
| context\_cache\_id | VARCHAR(255) | NULLABLE | The active Gemini cache ID for the server lore. |
| cache\_expires\_at | TIMESTAMP | NULLABLE | Tracks when the Gemini context cache TTL expires. |
| is\_active | BOOLEAN | DEFAULT TRUE | Toggle to pause the bot in specific servers. |
| created\_at | TIMESTAMP | DEFAULT NOW() | Timestamp of when the bot joined the server. |

### Global User Profiles Table

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| user\_id | VARCHAR(255) | PRIMARY KEY | The unique Discord User ID. |
| global\_name | VARCHAR(255) | NOT NULL | The user's global Discord display name. |
| created\_at | TIMESTAMP | DEFAULT NOW() | Timestamp of first interaction. |
| last\_interaction | TIMESTAMP | NULLABLE | Used to prune inactive profiles if needed. |

### Server Members (Per-User Context) Table

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| server\_id | VARCHAR(255) | FOREIGN KEY | References Server Settings. |
| user\_id | VARCHAR(255) | FOREIGN KEY | References Global User Profiles. |
| inferred\_context | TEXT | NULLABLE | Background LLM summary of the user's role and tone. |
| preferences | JSONB | DEFAULT '{}' | Structured data extracted by the LLM (e.g., {"games": ["Factorio"], "camera": "Nikon"}). |
| interaction\_count | INT | DEFAULT 0 | Tracks how often the user speaks to the bot. |
| PRIMARY KEY | (server\_id, user\_id) | Composite Key | Ensures one profile per user per server. |

### Channel Memory Vectors (pgvector) Table

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| id | UUID | PRIMARY KEY, DEFAULT gen\_random\_uuid() | Unique identifier for the memory chunk. |
| server\_id | VARCHAR(255) | NOT NULL | Hard boundary ensuring strict data isolation per server. |
| channel\_id | VARCHAR(255) | NOT NULL | Allows searching within a specific channel. |
| summary\_text | TEXT | NOT NULL | The English text chunk generated by the background worker. |
| embedding | VECTOR(768) | NOT NULL | The mathematical representation of the summary\_text. |
| time\_start | TIMESTAMP | NOT NULL | Timestamp of the oldest message in this chunk. |
| time\_end | TIMESTAMP | NOT NULL | Timestamp of the newest message in this chunk. |
| created\_at | TIMESTAMP | DEFAULT NOW() | When this vector was embedded. |

Note on Indexing: This table utilizes a B-Tree index on (server\_id, channel\_id) for metadata filtering, and an HNSW (Hierarchical Navigable Small World) index on the embedding column. The HNSW index is an advanced, highly efficient method for rapid approximate nearest neighbor (ANN) searches, ensuring fast retrieval during live chat.

## 10. Slash Commands API

### General User Commands

| Command | Arguments | Description / Use Case |
| :--- | :--- | :--- |
| /ask | query (text), private (boolean) | Ask a direct question. Ephemeral if private is true. |
| /summarize | hours (int), channel (optional) | Catch up on a fast-moving channel. |
| /recall | topic (text) | Triggers a semantic search of the pgvector database. |
| /event | action (create/list), details (text) | Schedule and track server activities. |
| /forget | scope (user/channel) | Wipes a user's inferred context or clears the short-term channel cache. |

### Admin and Moderation Commands

| Command | Arguments | Description / Use Case |
| :--- | :--- | :--- |
| /settings cache | action (refresh/clear) | Force-refresh the Gemini context cache for the server lore. |
| /settings model | provider (dropdown) | Dynamically swap the active LLM interface. |
| /lore | action (add/view), text (text) | Update the overarching rules and community themes. |
| /profile | user (mention) | View the inferred JSONB context built for a specific user. |

## Appendix: Discord Developer Portal Setup

Before writing any code, Contexta needs to be registered as an official application within the Discord ecosystem to generate the necessary API tokens and invite links.

### 1. Create the Application
Navigate to the Discord Developer Portal and log in.

Click the "New Application" button in the top right corner.

Name the application Contexta (or your chosen bot name), agree to the Terms of Service, and click Create.

(Optional but recommended): Upload a bot avatar and fill out the description in the "General Information" tab so users know what Contexta does.

### 2. Generate the Bot Token
In the left-hand menu, click on the **Bot** tab.

Under the "Build-A-Bot" section, click Add Bot (if it wasn't created automatically) and confirm.

Under the bot's username, click **Reset Token** to generate your unique API key.

> [!CAUTION]
> **CRITICAL:** Copy this token immediately and store it somewhere safe (like your local `.env` file as `DISCORD_TOKEN`). You will not be able to see it again without resetting it. Do not ever commit this token to GitHub.

### 3. Enable Privileged Gateway Intents
Because Contexta needs to maintain a rolling Redis cache of recent conversations and build user profiles, it must have explicit permission from Discord to read message content.

Stay on the **Bot** tab and scroll down to the **Privileged Gateway Intents** section.

Toggle ON the **SERVER MEMBERS INTENT** (Allows Contexta to see who joins/leaves and build the user profiles database).

Toggle ON the **MESSAGE CONTENT INTENT** (Mandatory for Contexta to read user messages for the short-term cache and long-term pgvector embedding).

Click **Save Changes** at the bottom of the screen.

### 4. Generate the Server Invite Link
To invite Contexta to your test server, you need to generate an OAuth2 URL with the correct scopes and permissions.

In the left-hand menu, click on **OAuth2**, then select **URL Generator**.

Under **Scopes**, check the following boxes:
- `bot`
- `applications.commands` (Required to register and use the slash commands like `/recall` and `/summarize`).

Under **Bot Permissions** (which appears after checking `bot`), select the minimum required permissions for Contexta to function:
- **Text Permissions:** Send Messages, Read Message History, Use External Emojis, Add Reactions, Embed Links, Attach Files.

Scroll to the bottom and copy the **Generated URL**.

Paste that URL into your browser, select your development/test server from the dropdown, and authorize the bot.