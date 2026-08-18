// engines/anthropic.js
// Envoie un prompt à Claude (via l'API Anthropic) et renvoie le texte de la réponse.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function askClaude(promptText) {
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: promptText }],
    // Active l'outil de recherche web côté serveur, pour coller à ce qu'un
    // utilisateur réel voit sur claude.ai aujourd'hui (comme pour ChatGPT via
    // gpt-4o-search-preview et Google AI Overview via SerpApi) plutôt que de
    // mesurer uniquement la connaissance figée du modèle. Claude décide
    // lui-même s'il a besoin de chercher pour répondre, comme dans l'appli.
    // À vérifier/ajuster selon la doc Anthropic à jour (nom d'outil versionné,
    // ex: "web_search_20250305") si l'appel échoue avec une clé récente.
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
        user_location: {
          type: "approximate",
          city: "Paris",
          region: "Île-de-France",
          country: "FR",
          timezone: "Europe/Paris",
        },
      },
    ],
  });

  // Avec la recherche web activée, la réponse peut contenir plusieurs blocs
  // "text" entrecoupés de blocs d'outil (recherche, citations) : on les
  // concatène tous pour ne pas perdre de texte.
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
