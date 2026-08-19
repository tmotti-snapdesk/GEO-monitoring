// sentiment.js
// Demande à Claude d'évaluer le ton (positif/neutre/négatif) d'un passage qui
// mentionne Snapdesk. Volontairement séparé des engines/ : ce n'est pas une
// des 3 sources qu'on monitore, mais un LLM utilisé comme "juge".
//
// N'est appelé que quand Snapdesk est effectivement cité (voir run.js), pour
// ne pas ajouter un 4e appel API sur les 2/3 des prompts où ça ne sert à rien.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_SENTIMENTS = ["positive", "neutral", "negative"];

export async function analyzeSentiment(mentionContext) {
  const response = await client.messages.create({
    // Un modèle "juge" peut être différent (moins cher/plus rapide) du modèle
    // dont on mesure par ailleurs la visibilité — d'où une variable séparée.
    model:
      process.env.ANTHROPIC_SENTIMENT_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      "claude-sonnet-5",
    max_tokens: 8,
    messages: [
      {
        role: "user",
        content: `Voici un extrait d'une réponse d'IA qui mentionne "Snapdesk", un opérateur d'espaces de bureaux flexibles à Paris. Le ton de cet extrait à l'égard de Snapdesk est-il positif, neutre ou négatif ?

Extrait :
"""
${mentionContext}
"""

Réponds uniquement par un seul mot parmi : positive, neutral, negative.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = (textBlock?.text ?? "").trim().toLowerCase();
  return VALID_SENTIMENTS.find((s) => raw.includes(s)) ?? "neutral";
}
