// engines/anthropic.js
// Envoie un prompt à Claude (via l'API Anthropic) et renvoie le texte de la réponse.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function askClaude(promptText) {
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: promptText }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
