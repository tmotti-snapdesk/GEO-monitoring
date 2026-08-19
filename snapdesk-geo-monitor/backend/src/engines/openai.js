// engines/openai.js
// Envoie un prompt à ChatGPT (via l'API OpenAI) et renvoie le texte de la réponse.
// C'est volontairement un appel "sec", sans historique de conversation : on simule
// une personne qui pose UNE question à ChatGPT, comme le ferait un vrai prospect.

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askChatGPT(promptText) {
  const response = await client.chat.completions.create({
    // gpt-4o-search-preview = ChatGPT avec accès web activé, pour coller à ce
    // qu'un utilisateur réel voit sur chat.openai.com aujourd'hui (comme
    // Google AI Overview via SerpApi, ce n'est plus la connaissance "figée"
    // du modèle mais une vraie recherche web à chaque appel).
    // Pour revenir à la connaissance brute du modèle (sans web), remplace par
    // "gpt-4o" — les modèles *-search-preview ne supportent pas certains
    // paramètres de sampling (temperature, top_p), qu'on ne fixe pas ici.
    model: process.env.OPENAI_MODEL || "gpt-4o-search-preview",
    messages: [{ role: "user", content: promptText }],
    // Aligne la localisation de la recherche avec le marché ciblé (Paris),
    // comme pour SerpApi (voir serpapi.js) — sans quoi le web search
    // par défaut n'a aucune raison de favoriser des résultats parisiens.
    web_search_options: {
      user_location: {
        type: "approximate",
        approximate: { country: "FR", city: "Paris", region: "Île-de-France" },
      },
    },
    // store: false => la réponse n'est pas conservée côté OpenAI pour de
    // l'évaluation/distillation de modèle. Sans lien avec un éventuel biais
    // d'historique (l'API est de toute façon sans état, voir README), c'est
    // une précaution de confidentialité : ces prompts et réponses contiennent
    // de l'intelligence concurrentielle qu'on ne veut pas voir traînée ailleurs.
    store: false,
  });

  return response.choices[0]?.message?.content ?? "";
}
