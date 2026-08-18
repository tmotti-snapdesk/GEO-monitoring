// api.js
// Petit serveur web (Express) qui lit la base de données locale et expose des
// résultats déjà agrégés sous forme de JSON, pour que le dashboard Next.js
// n'ait qu'à les afficher (pas de calcul côté frontend).
//
// Lancement :  npm run api
// Le serveur écoute sur http://localhost:4000

import "dotenv/config";
import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
app.use(cors());

const PORT = process.env.API_PORT || 4000;

// GET /api/timeseries
// Renvoie, pour chaque date de run et chaque moteur, le taux de citation de
// Snapdesk (en %) sur l'ensemble des prompts testés ce jour-là.
app.get("/api/timeseries", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        run_at,
        engine,
        COUNT(*) AS total_prompts,
        SUM(snapdesk_mentioned) AS snapdesk_mentions
      FROM results
      GROUP BY run_at, engine
      ORDER BY run_at ASC
    `
    )
    .all();

  const withRate = rows.map((r) => ({
    ...r,
    citation_rate: r.total_prompts
      ? Math.round((r.snapdesk_mentions / r.total_prompts) * 1000) / 10
      : 0,
  }));

  res.json(withRate);
});

// GET /api/latest-summary
// Pour le run le plus récent : taux de citation par moteur + classement des
// concurrents les plus souvent cités à la place de (ou à côté de) Snapdesk.
app.get("/api/latest-summary", (req, res) => {
  const latestRun = db
    .prepare(`SELECT MAX(run_at) AS run_at FROM results`)
    .get()?.run_at;

  if (!latestRun) {
    return res.json({ run_at: null, byEngine: [], topCompetitors: [] });
  }

  const byEngine = db
    .prepare(
      `
      SELECT
        engine,
        COUNT(*) AS total_prompts,
        SUM(snapdesk_mentioned) AS snapdesk_mentions
      FROM results
      WHERE run_at = ?
      GROUP BY engine
    `
    )
    .all(latestRun)
    .map((r) => ({
      ...r,
      citation_rate: r.total_prompts
        ? Math.round((r.snapdesk_mentions / r.total_prompts) * 1000) / 10
        : 0,
    }));

  const allRows = db
    .prepare(`SELECT competitors_mentioned FROM results WHERE run_at = ?`)
    .all(latestRun);

  const counts = {};
  for (const row of allRows) {
    const names = JSON.parse(row.competitors_mentioned || "[]");
    for (const name of names) {
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  const topCompetitors = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({ run_at: latestRun, byEngine, topCompetitors });
});

// GET /api/results?run_at=...&engine=...
// Détail brut (utile pour aller inspecter une réponse précise dans le dashboard).
app.get("/api/results", (req, res) => {
  const { run_at, engine } = req.query;
  let query = "SELECT * FROM results WHERE 1=1";
  const params = [];
  if (run_at) {
    query += " AND run_at = ?";
    params.push(run_at);
  }
  if (engine) {
    query += " AND engine = ?";
    params.push(engine);
  }
  query += " ORDER BY prompt_id ASC";
  res.json(db.prepare(query).all(...params));
});

app.listen(PORT, () => {
  console.log(`API de résultats disponible sur http://localhost:${PORT}`);
});
