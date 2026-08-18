// engines/serpapi.js
// Google n'a pas d'API officielle pour son "AI Overview" (le résumé généré par IA
// qui apparaît en haut de certains résultats de recherche). On passe donc par
// SerpApi, un service tiers qui simule une vraie recherche Google et nous retourne
// le contenu structuré de la page de résultats, y compris l'AI Overview quand il existe.
//
// Important : contrairement à ChatGPT/Claude, ici on n'envoie pas une "question
// conversationnelle" mais plutôt une requête de recherche. On garde quand même les
// prompts formulés en langage naturel car Google gère de mieux en mieux ce type de
// requêtes longues, et c'est justement ce qu'on veut mesurer.

import fetch from "node-fetch";

export async function getGoogleAIOverview(promptText) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", promptText);
  url.searchParams.set("location", "Paris, France");
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "fr");
  url.searchParams.set("api_key", process.env.SERPAPI_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`SerpApi a répondu avec le statut ${res.status}`);
  }
  const data = await res.json();

  // Le champ exact dépend de la réponse SerpApi : selon les cas, il s'agit de
  // "ai_overview.text_blocks" ou d'un champ similaire. On concatène tout le texte
  // disponible pour ne rien perdre lors de l'analyse des mentions.
  if (!data.ai_overview) {
    return ""; // Pas d'AI Overview pour cette requête (ça arrive souvent, c'est une donnée en soi !)
  }

  const blocks = data.ai_overview.text_blocks || [];
  return blocks.map((b) => b.snippet || b.text || "").join("\n");
}
