// run.js
// C'est le script "chef d'orchestre". Il :
//  1. charge la liste des 100 prompts
//  2. pour chaque prompt, interroge ChatGPT, Claude et Google AI Overview
//  3. analyse chaque réponse (mention de Snapdesk ? position ? concurrents cités ?)
//  4. enregistre tout dans la base de données locale (data.sqlite)
//
// Lancement manuel :   npm run run-once
// Lancement planifié :  npm run schedule   (voir scheduler.js)
//
// ATTENTION AUX COÛTS : 100 prompts x 3 moteurs = 300 appels API par exécution.
// Sur OpenAI/Anthropic ça reste de l'ordre de quelques euros ; sur SerpApi (plan
// gratuit à 100 requêtes/mois) tu dépasseras vite le quota gratuit si tu lances ça
// chaque semaine sur les 100 prompts. Deux options :
//   - ajuster START_INDEX / END_INDEX ci-dessous pour tourner sur un sous-ensemble
//   - passer sur un plan SerpApi payant une fois que le POC te convainc

import "dotenv/config";
import promptsData from "../config/prompts.json" with { type: "json" };
import { askChatGPT } from "./engines/openai.js";
import { askClaude } from "./engines/anthropic.js";
import { getGoogleAIOverview } from "./engines/serpapi.js";
import { analyzeResponse } from "./analyze.js";
import { insertResult } from "./db.js";

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
        const rawResponse = await engine.fn(prompt.prompt_fr);
        const analysis = analyzeResponse(rawResponse);

        insertResult({
          run_at: runAt,
          engine: engine.key,
          prompt_id: prompt.id,
          prompt_category: prompt.category,
          prompt_text: prompt.prompt_fr,
          raw_response: rawResponse,
          snapdesk_mentioned: analysis.snapdesk_mentioned,
          snapdesk_position: analysis.snapdesk_position,
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
