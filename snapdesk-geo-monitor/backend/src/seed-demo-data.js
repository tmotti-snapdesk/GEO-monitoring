// seed-demo-data.js
// Remplit data.sqlite avec des résultats FICTIFS mais réalistes, sur 4 runs
// hebdomadaires, pour prévisualiser le dashboard sans dépenser sur les vraies
// API (utile pour une démo, ou pour vérifier l'UI après un changement de
// schéma). N'appelle aucune IA — tout est généré aléatoirement en local.
//
// Lancement :  npm run seed-demo
// Pour repartir d'une base vide avant de lancer un vrai monitoring, supprime
// simplement backend/data.sqlite après avoir regardé le dashboard.

import promptsData from "../config/prompts.json" with { type: "json" };
import competitors from "../config/competitors.json" with { type: "json" };
import { computeGeoScore } from "./score.js";
import { insertResult } from "./db.js";

const ENGINES = ["chatgpt", "claude", "google_ai_overview", "gemini"];
const ALL_COMPETITOR_NAMES = [
  ...competitors.categories.direct_coworking,
  ...competitors.categories.direct_operators,
  ...competitors.categories.indirect_brokers,
].map((c) => (typeof c === "string" ? c : c.name));

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 4 runs hebdomadaires, le plus récent = aujourd'hui, avec une tendance de
// visibilité qui s'améliore légèrement au fil du temps (plus parlant à l'œil
// sur le graphique que du pur bruit aléatoire).
const NUM_RUNS = 4;
const now = new Date();
const runDates = Array.from({ length: NUM_RUNS }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() - (NUM_RUNS - 1 - i) * 7);
  return d.toISOString();
});

for (const [runIndex, runAt] of runDates.entries()) {
  // Taux de citation qui progresse : ~28% sur le run le plus ancien, ~48% sur
  // le plus récent.
  const baseMentionRate = 0.28 + (0.2 * runIndex) / (NUM_RUNS - 1);

  for (const prompt of promptsData) {
    for (const engine of ENGINES) {
      const mentioned = Math.random() < baseMentionRate ? 1 : 0;
      const position = mentioned ? 1 + Math.floor(Math.random() * 4) : null;

      let sentiment = null;
      if (mentioned) {
        const r = Math.random();
        sentiment = r < 0.55 ? "positive" : r < 0.85 ? "neutral" : "negative";
      }

      const geoScore = computeGeoScore({ mentioned, position, sentiment });

      const competitorsMentioned = ALL_COMPETITOR_NAMES.filter(
        () => Math.random() < 0.15
      ).slice(0, 3);

      await insertResult({
        run_at: runAt,
        engine,
        prompt_id: prompt.id,
        prompt_category: prompt.category,
        prompt_text: prompt.prompt_fr,
        raw_response: mentioned
          ? `[Réponse fictive de démo] ... Snapdesk pourrait être une bonne option pour votre équipe ...`
          : `[Réponse fictive de démo] ... ${pick(ALL_COMPETITOR_NAMES)} propose des espaces adaptés ...`,
        snapdesk_mentioned: mentioned,
        snapdesk_position: position,
        snapdesk_sentiment: sentiment,
        geo_score: geoScore,
        competitors_mentioned: JSON.stringify(competitorsMentioned),
        error: null,
      });
    }
  }
  console.log(`Run fictif inséré : ${runAt}`);
}

console.log(
  `\n${NUM_RUNS} runs de démo générés (${promptsData.length} prompts x ${ENGINES.length} moteurs chacun). Lance "npm run dev" dans frontend/ pour les voir.`
);
