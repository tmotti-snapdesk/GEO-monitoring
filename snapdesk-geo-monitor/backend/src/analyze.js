// analyze.js
// Analyse une réponse texte pour savoir :
//  1. si Snapdesk est cité
//  2. à quelle "position" (le 1er acteur cité, le 2e, etc. compte plus qu'un acteur
//     cité en dernier dans une liste)
//  3. quels concurrents sont cités
//
// NB : c'est une détection par mot-clé, volontairement simple pour démarrer.
// Une amélioration future possible : demander à un LLM d'évaluer le sentiment
// autour de chaque mention (positif/neutre/négatif), pas seulement sa présence.

import competitors from "../config/competitors.json" with { type: "json" };

const ALL_COMPETITOR_NAMES = [
  ...competitors.categories.direct_coworking,
  ...competitors.categories.direct_operators,
  ...competitors.categories.indirect_brokers,
];

function findAllMentions(text, names) {
  // Renvoie [{ name, index }] triés par ordre d'apparition dans le texte
  const found = [];
  const lowerText = text.toLowerCase();
  for (const name of names) {
    const idx = lowerText.indexOf(name.toLowerCase());
    if (idx !== -1) {
      found.push({ name, index: idx });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

export function analyzeResponse(text) {
  if (!text || text.trim() === "") {
    return {
      snapdesk_mentioned: 0,
      snapdesk_position: null,
      competitors_mentioned: [],
    };
  }

  const allNames = ["Snapdesk", ...ALL_COMPETITOR_NAMES];
  const mentions = findAllMentions(text, allNames);

  const snapdeskIndexInList = mentions.findIndex(
    (m) => m.name.toLowerCase() === "snapdesk"
  );

  const competitorsMentioned = mentions
    .filter((m) => m.name.toLowerCase() !== "snapdesk")
    .map((m) => m.name);

  return {
    snapdesk_mentioned: snapdeskIndexInList !== -1 ? 1 : 0,
    // position 1-indexée parmi TOUS les acteurs cités (Snapdesk + concurrents),
    // dans l'ordre où ils apparaissent dans le texte
    snapdesk_position:
      snapdeskIndexInList !== -1 ? snapdeskIndexInList + 1 : null,
    competitors_mentioned: competitorsMentioned,
  };
}
