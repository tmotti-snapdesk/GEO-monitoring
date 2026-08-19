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
  const config = {};
  // La recherche web (grounding) a souvent un quota séparé, plus restrictif
  // que la génération de texte simple sur le tier gratuit — si le compte
  // Gemini n'a pas de billing activé, désactive-la avec GEMINI_WEB_SEARCH=false
  // en attendant, plutôt que de bloquer complètement ce moteur.
  if (process.env.GEMINI_WEB_SEARCH !== "false") {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    contents: promptText,
    config,
  });

  return response.text ?? "";
}
