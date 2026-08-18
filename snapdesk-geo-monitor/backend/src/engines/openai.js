// engines/openai.js
// Envoie un prompt à ChatGPT (via l'API OpenAI) et renvoie le texte de la réponse.
// C'est volontairement un appel "sec", sans historique de conversation : on simule
// une personne qui pose UNE question à ChatGPT, comme le ferait un vrai prospect.

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askChatGPT(promptText) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [{ role: "user", content: promptText }],
    // On désactive la recherche web pour mesurer la connaissance "brute" du modèle.
    // Si tu veux plutôt mesurer ce que ChatGPT dit QUAND il a accès au web,
    // remplace ce modèle par un modèle avec recherche (ex: "gpt-4o-search-preview").
  });

  return response.choices[0]?.message?.content ?? "";
}
