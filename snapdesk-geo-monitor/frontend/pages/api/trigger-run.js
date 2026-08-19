// POST /api/trigger-run
// Déclenche le workflow GitHub Actions "GEO Monitor" à la demande depuis le
// dashboard (bouton), plutôt que d'attendre le lundi ou de passer par
// l'onglet Actions de GitHub. Body JSON optionnel :
//   { enginesEnabled?: string, promptEndIndex?: number }
//
// Garde-fou anti-abus : cette route n'est pas authentifiée (comme le reste de
// l'API, voir le README) et chaque déclenchement dépense du crédit API réel.
// On refuse un nouveau déclenchement si le dernier run enregistré en base a
// moins de MIN_MINUTES_BETWEEN_RUNS minutes, pour qu'un clic répété (ou un
// visiteur malveillant qui trouve l'URL) ne puisse pas multiplier les coûts.

import { db } from "../../lib/db";

const GITHUB_OWNER = "tmotti-snapdesk";
const GITHUB_REPO = "GEO-monitoring";
const WORKFLOW_FILE = "geo-monitor.yml";
const MIN_MINUTES_BETWEEN_RUNS = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({
      error:
        "GITHUB_TOKEN manquant côté serveur (variable d'environnement Vercel).",
    });
  }

  try {
    const { rows } = await db.execute(`SELECT MAX(run_at) AS run_at FROM results`);
    const lastRunAt = rows[0]?.run_at;
    if (lastRunAt) {
      const minutesSince = (Date.now() - new Date(lastRunAt).getTime()) / 60000;
      if (minutesSince < MIN_MINUTES_BETWEEN_RUNS) {
        return res.status(429).json({
          error: `Un run a déjà été lancé il y a ${Math.round(
            minutesSince
          )} min. Attends au moins ${MIN_MINUTES_BETWEEN_RUNS} min entre deux déclenchements pour éviter de multiplier les coûts par erreur.`,
        });
      }
    }

    const { enginesEnabled, promptEndIndex } = req.body || {};

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            engines_enabled: enginesEnabled || "",
            prompt_end_index: promptEndIndex ? String(promptEndIndex) : "",
          },
        }),
      }
    );

    if (!ghRes.ok) {
      const detail = await ghRes.text();
      return res
        .status(502)
        .json({ error: `GitHub a refusé le déclenchement (${ghRes.status}) : ${detail}` });
    }

    res.status(202).json({
      message:
        "Run déclenché sur GitHub Actions. Ça prend de quelques minutes (test réduit) à 15-20 min (run complet) — recharge le dashboard une fois terminé.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
