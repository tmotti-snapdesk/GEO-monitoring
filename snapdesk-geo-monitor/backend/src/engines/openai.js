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
    //
    // store: false => la réponse n'est pas conservée côté OpenAI pour de
    // l'évaluation/distillation de modèle. Sans lien avec un éventuel biais
    // d'historique (l'API est de toute façon sans état, voir README), c'est
    // une précaution de confidentialité : ces prompts et réponses contiennent
    // de l'intelligence concurrentielle qu'on ne veut pas voir traînée ailleurs.
    store: false,
  });

  return response.choices[0]?.message?.content ?? "";
}
