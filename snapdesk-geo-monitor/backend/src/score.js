// score.js
// Score GEO combiné (0 à 100) pour un résultat (un prompt x un moteur) :
// combine présence, rang d'apparition et sentiment en un seul chiffre pour
// pouvoir comparer/suivre facilement dans le temps, plutôt que de jongler
// avec 3 métriques séparées.
//
//  - Pas cité                           => 0
//  - Cité en position N, ton neutre     => 100 / N   (rang "reciprocal rank" :
//                                          100 si cité en 1er, 50 en 2e, ~33 en 3e...)
//  - Le score de rang est ensuite pondéré par le sentiment : une mention
//    positive compte pleinement, une mention négative est fortement pénalisée
//    (être cité de façon négative reste "vu", mais c'est un risque, pas un
//    succès).
//
// C'est une heuristique de départ, pas une vérité absolue — les poids
// ci-dessous sont volontairement simples et peuvent être ajustés.
const SENTIMENT_MULTIPLIER = {
  positive: 1,
  neutral: 0.7,
  negative: 0.3,
};
const DEFAULT_MULTIPLIER = 0.7; // si le sentiment n'a pas pu être déterminé

export function computeGeoScore({ mentioned, position, sentiment }) {
  if (!mentioned || !position) return 0;
  const rankScore = 100 / position;
  const multiplier = SENTIMENT_MULTIPLIER[sentiment] ?? DEFAULT_MULTIPLIER;
  return Math.round(rankScore * multiplier * 10) / 10;
}
