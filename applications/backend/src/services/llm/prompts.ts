/**
 * Pipeline 1: Message Tagger
 * Classifies messages for topics, decisions, action items, references.
 */
export function buildTaggingPrompt(messages: { id: string; content: string; displayName: string }[]): string {
  const messageList = messages.map((m, i) => `[${i}] ${m.displayName}: ${m.content}`).join('\n');

  return `You are a message classifier for a Discord server. Analyze each message and extract structured tags.

For each message, output a JSON object with:
- "index": the message index number
- "topics": array of 0-3 topic strings (short, lowercase, e.g. "docker", "api design", "hiring")
- "isDecision": true if the message announces or confirms a decision
- "isActionItem": true if the message assigns or commits to an action
- "isReference": true if the message shares a URL, doc, or external resource
- "confidence": 0.0-1.0 how confident you are in your classification

Messages that are casual chat, greetings, or reactions with no substantive content should get empty topics and 0.1 confidence.

Output a JSON array of objects. No markdown, no explanation, just the JSON array.

Messages:
${messageList}`;
}

/**
 * Pipeline 2: Knowledge Extractor
 * Extracts structured knowledge entries from conversation chunks.
 */
export function buildExtractionPrompt(
  messages: { displayName: string; content: string; createdAt: string }[],
  existingEntries: { id: string; title: string; type: string }[]
): string {
  const conversation = messages.map(m => `[${m.createdAt}] ${m.displayName}: ${m.content}`).join('\n');
  const existing = existingEntries.length > 0
    ? existingEntries.map(e => `- [${e.id}] (${e.type}) ${e.title}`).join('\n')
    : 'None yet.';

  return `You are a knowledge extractor for a Discord server. Analyze this conversation chunk and extract structured knowledge entries.

For each piece of knowledge found, output a JSON object with:
- "type": one of "topic", "decision", "entity", "action_item", "reference"
- "title": short descriptive title (under 100 chars)
- "content": full description of the knowledge (1-3 sentences)
- "confidence": 0.0-1.0 how confident you are this is real knowledge (not speculation or jokes)
- "linkedEntryIds": array of IDs from existing entries that this relates to (can be empty)
- "linkRelationship": if linkedEntryIds is non-empty, one of "relates_to", "supersedes", "part_of", "led_to"

Rules:
- Only extract genuine knowledge, decisions, or references. Skip casual chat.
- A "decision" must be clearly agreed upon, not just suggested.
- An "action_item" must have a clear owner or commitment.
- An "entity" is a project, tool, person, or concept referenced multiple times.
- Confidence below 0.3 means "probably not real knowledge."

Existing knowledge entries (for linking):
${existing}

Conversation:
${conversation}

Output a JSON array of objects. No markdown, no explanation, just the JSON array.`;
}

/**
 * Pipeline 3: Channel Summarizer
 * Generates structured daily/weekly channel summaries.
 */
export function buildSummaryPrompt(
  channelName: string,
  messages: { displayName: string; content: string; createdAt: string }[]
): string {
  const conversation = messages.map(m => `[${m.createdAt}] ${m.displayName}: ${m.content}`).join('\n');

  return `You are a channel summarizer for a Discord server. Summarize the following conversation from #${channelName}.

Output a single JSON object with:
- "summary": a 2-5 sentence narrative summary of what was discussed
- "topics": array of topic strings discussed (short, lowercase)
- "decisions": array of decisions made (full sentence each, empty array if none)
- "openQuestions": array of unresolved questions raised (empty array if none)
- "actionItems": array of action items committed to (include who if mentioned, empty array if none)

Rules:
- Be factual and specific. Include names when relevant.
- Only include decisions that were clearly agreed upon.
- Open questions are things explicitly asked but not answered.
- Keep the summary concise but informative.

Conversation from #${channelName}:
${conversation}

Output a single JSON object. No markdown, no explanation, just the JSON.`;
}

/**
 * Pipeline 4: Profile Inferencer
 * Infers user expertise and communication preferences from their messages.
 */
export function buildProfilePrompt(
  displayName: string,
  messages: { content: string; tags: { topics: string[] } | null }[]
): string {
  const sampleMessages = messages.slice(0, 50).map(m => {
    const tagStr = m.tags?.topics?.length ? ` [topics: ${m.tags.topics.join(', ')}]` : '';
    return `- ${m.content}${tagStr}`;
  }).join('\n');

  return `You are a user profile analyzer for a Discord server. Analyze this user's recent messages to infer their expertise and communication style.

User: ${displayName}

Output a single JSON object with:
- "expertiseTopics": array of objects, each with "topic" (string) and "score" (0.0-1.0, where 1.0 = clearly an expert)
  Only include topics where the user shows real knowledge, not just mentions.
  Max 10 topics.
- "communicationStyle": one of "casual", "formal", "technical", "mixed"
- "verbosity": one of "concise", "moderate", "detailed"
- "technicalLevel": one of "low", "medium", "high"
- "summary": 1-2 sentence natural language description of this user's role and expertise

Rules:
- Base expertise scores on demonstrated knowledge, not just frequency of mention.
- A user asking questions about a topic is NOT expertise — it's interest.
- Communication style should reflect their actual writing, not the topics.

Recent messages:
${sampleMessages}

Output a single JSON object. No markdown, no explanation, just the JSON.`;
}
