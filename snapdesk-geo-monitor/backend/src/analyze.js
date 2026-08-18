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

// Une entrée de competitors.json peut être soit un simple nom ("WeWork"), soit
// un objet { name, aliases } quand une marque a plusieurs façons d'être citée
// (ex : "Les Nouveaux Bureaux" / "LNB") — dans ce cas toutes les variantes
// comptent pour UNE seule mention, sous le nom canonique "name".
function normalizeEntry(entry) {
  return typeof entry === "string"
    ? { name: entry, aliases: [] }
    : { name: entry.name, aliases: entry.aliases || [] };
}

const ALL_COMPETITOR_ENTRIES = [
  ...competitors.categories.direct_coworking,
  ...competitors.categories.direct_operators,
  ...competitors.categories.indirect_brokers,
].map(normalizeEntry);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Position de la première occurrence de `term` dans `text`, avec des limites de
// mot (\b) pour éviter qu'un nom court comme "Sora" ne matche à l'intérieur d'un
// autre mot. -1 si absent.
function findFirstIndex(text, term) {
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

// Renvoie [{ name, index }] triés par ordre d'apparition dans le texte. Pour une
// entrée avec alias, on garde la position de la variante qui apparaît en premier.
function findAllMentions(text, entries) {
  const found = [];
  for (const entry of entries) {
    const terms = [entry.name, ...entry.aliases];
    let bestIndex = -1;
    for (const term of terms) {
      const idx = findFirstIndex(text, term);
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
      }
    }
    if (bestIndex !== -1) {
      found.push({ name: entry.name, index: bestIndex });
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

  const allEntries = [normalizeEntry("Snapdesk"), ...ALL_COMPETITOR_ENTRIES];
  const mentions = findAllMentions(text, allEntries);

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
