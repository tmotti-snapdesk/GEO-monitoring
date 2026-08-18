// run.js
// C'est le script "chef d'orchestre". Il :
//  1. charge la liste des 100 prompts
//  2. pour chaque prompt, interroge ChatGPT, Claude et Google AI Overview
//  3. analyse chaque réponse (mention de Snapdesk ? position ? concurrents cités ?)
//  4. si Snapdesk est cité, demande à Claude d'évaluer le sentiment de la mention
//  5. calcule un score GEO combiné (voir score.js) et enregistre tout dans la
//     base de données locale (data.sqlite)
//
// Lancement manuel :   npm run run-once
// Lancement planifié :  npm run schedule   (voir scheduler.js)
//
// ATTENTION AUX COÛTS : 100 prompts x 3 moteurs = 300 appels API par exécution,
// plus un appel Claude supplémentaire (léger) pour chaque résultat où Snapdesk
// est cité. ChatGPT et Claude interrogent maintenant le web en direct (voir
// engines/openai.js et anthropic.js) pour coller à ce qu'un vrai utilisateur
// voit aujourd'hui — ça ajoute un coût par recherche en plus du coût par
// token, en plus du coût SerpApi (plan gratuit à 100 requêtes/mois, vite
// dépassé en hebdo sur 100 prompts). Vérifie les tarifs à jour sur
// platform.openai.com/pricing et anthropic.com/pricing avant un premier run
// complet. Deux options pour maîtriser les coûts :
//   - ajuster START_INDEX / END_INDEX ci-dessous pour tourner sur un sous-ensemble
//   - passer sur des plans payants une fois que le POC te convainc

import "dotenv/config";
import promptsData from "../config/prompts.json" with { type: "json" };
import { askChatGPT } from "./engines/openai.js";
import { askClaude } from "./engines/anthropic.js";
import { getGoogleAIOverview } from "./engines/serpapi.js";
import { analyzeResponse, getSnapdeskContext } from "./analyze.js";
import { analyzeSentiment } from "./sentiment.js";
import { computeGeoScore } from "./score.js";
import { insertResult } from "./db.js";
import { withRetry } from "./utils/retry.js";

// Pour tester sur un petit lot avant de lancer les 100 : modifie ces deux valeurs.
const START_INDEX = 0;
const END_INDEX = promptsData.length; // 100 par défaut

const ENGINES = [
  { key: "chatgpt", fn: askChatGPT },
  { key: "claude", fn: askClaude },
  { key: "google_ai_overview", fn: getGoogleAIOverview },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  const runAt = new Date().toISOString();
  const prompts = promptsData.slice(START_INDEX, END_INDEX);

  console.log(
    `Démarrage du run à ${runAt} — ${prompts.length} prompts x ${ENGINES.length} moteurs = ${
      prompts.length * ENGINES.length
    } appels API prévus.`
  );

  let done = 0;
  const total = prompts.length * ENGINES.length;

  for (const prompt of prompts) {
    for (const engine of ENGINES) {
      try {
        const rawResponse = await withRetry(() => engine.fn(prompt.prompt_fr));
        const analysis = analyzeResponse(rawResponse);

        // On ne juge le sentiment que si Snapdesk est cité : ça évite un 4e
        // appel API (donc un coût) sur les prompts où ça n'apporte rien.
        let sentiment = null;
        if (analysis.snapdesk_mentioned) {
          const context = getSnapdeskContext(rawResponse);
          sentiment = await withRetry(() => analyzeSentiment(context));
        }

        const geoScore = computeGeoScore({
          mentioned: analysis.snapdesk_mentioned,
          position: analysis.snapdesk_position,
          sentiment,
        });

        insertResult({
          run_at: runAt,
          engine: engine.key,
          prompt_id: prompt.id,
          prompt_category: prompt.category,
          prompt_text: prompt.prompt_fr,
          raw_response: rawResponse,
          snapdesk_mentioned: analysis.snapdesk_mentioned,
          snapdesk_position: analysis.snapdesk_position,
          snapdesk_sentiment: sentiment,
          geo_score: geoScore,
          competitors_mentioned: JSON.stringify(analysis.competitors_mentioned),
          error: null,
        });
      } catch (err) {
        console.error(
          `Erreur sur prompt #${prompt.id} / ${engine.key}:`,
          err.message
        );
        insertResult({
          run_at: runAt,
          engine: engine.key,
          prompt_id: prompt.id,
          prompt_category: prompt.category,
          prompt_text: prompt.prompt_fr,
          raw_response: null,
          snapdesk_mentioned: 0,
          snapdesk_position: null,
          snapdesk_sentiment: null,
          geo_score: 0,
          competitors_mentioned: "[]",
          error: err.message,
        });
      }

      done += 1;
      if (done % 10 === 0) console.log(`  ... ${done}/${total} appels effectués`);

      // Petite pause pour rester tranquille avec les limites de débit des API.
      await sleep(300);
    }
  }

  console.log(`Run terminé (${runAt}). Résultats stockés dans backend/data.sqlite.`);
}

runOnce();
