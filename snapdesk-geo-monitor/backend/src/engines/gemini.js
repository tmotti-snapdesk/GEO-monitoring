// engines/gemini.js
// Envoie un prompt à Gemini (via l'API Google Generative AI) et renvoie le
// texte de la réponse. Utilisé comme alternative à Google AI Overview
// (serpapi.js) : mesure ce que dit le chatbot Gemini lui-même, pas l'AI
// Overview qui apparaît dans les résultats de recherche Google — deux
// surfaces différentes. AI Overview reste la plus représentative de la
// recherche Google classique ; Gemini a l'avantage d'une API officielle
// simple, sans dépendre d'un compte SerpApi.

import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askGemini(promptText) {
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: promptText,
    config: {
      // Active la recherche web (grounding), pour coller à ce qu'un vrai
      // utilisateur voit sur gemini.google.com — même logique que
      // gpt-4o-search-preview et l'outil web_search de Claude.
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text ?? "";
}
