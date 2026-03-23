# Contexta - AI Agent Instructions (AGENTS.md)

## Project Overview

Contexta is an intelligent, persistent AI assistant for Discord. It operates as a reliable, always-on co-host capable of managing multi-user, multi-turn conversations. It relies on a tiered memory architecture to track server rules, active channel context, and user-specific preferences without bloating the LLM prompt.

## Tech Stack & Environment

  - Runtime: Node.js (TypeScript)
  - Discord Interface: discord.js
  - LLM Provider: Gemini 2.5 Flash (via Google Gen AI SDK)
  - Primary Database: PostgreSQL with the pgvector extension
  - Short-Term Cache: Redis
  - Target Deployment: Railway

## Developer Profile & Code Standards

The human maintainer is an experienced TypeScript and Node.js software engineer.

  - Skip beginner-level tutorials or overly verbose inline comments explaining basic Node concepts.
  - Focus on robust, production-ready architecture.
  - Prioritize clean abstraction, efficient asynchronous error handling, and strict typing (leveraging TypeScript).

## Core Architectural Directives

1.  Model Abstraction: Do not tightly couple the Discord event handlers directly to the Gemini API. Use an abstraction layer (Adapter pattern) so the underlying LLM provider can be swapped via server settings.
2.  Gemini Context Caching: This is a critical cost-saving requirement. The overarching server lore must be cached via the Gemini API, and the application must track the cache TTL.
3.  Data Isolation: Under no circumstances should memory or context bleed between servers. All database queries (especially pgvector semantic searches) must strictly filter by `server_id`.
4.  Non-Blocking Design: Ensure background tasks (like summarizing Redis cache and generating vector embeddings) do not block the main Discord websocket event loop.

## Current Project State

Status: Initialization Phase
The system design document is complete. We are moving from planning to initial scaffolding.

## Immediate Next Steps (Task 1)

1.  Generate the `package.json` with necessary dependencies (including `typescript`, `discord.js`, `@google/genai`, `pg`, `redis`, `dotenv`).
2.  Scaffold the directory structure (e.g., separating commands, events, database utilities, and LLM services).
3.  Draft the initial `index.ts` entry point with a basic Discord client login.
4.  Draft the configuration files required for deployment on Railway.

-----

Would you like me to draft the `package.json` file next, or should we create the initial database connection utility script?