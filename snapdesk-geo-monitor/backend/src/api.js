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
        SUM(snapdesk_mentioned) AS snapdesk_mentions,
        AVG(geo_score) AS avg_geo_score
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
    avg_geo_score: r.avg_geo_score ? Math.round(r.avg_geo_score * 10) / 10 : 0,
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
    return res.json({
      run_at: null,
      byEngine: [],
      topCompetitors: [],
      sentimentBreakdown: [],
    });
  }

  const byEngine = db
    .prepare(
      `
      SELECT
        engine,
        COUNT(*) AS total_prompts,
        SUM(snapdesk_mentioned) AS snapdesk_mentions,
        AVG(geo_score) AS avg_geo_score
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
      avg_geo_score: r.avg_geo_score ? Math.round(r.avg_geo_score * 10) / 10 : 0,
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

  // Répartition du sentiment des mentions de Snapdesk sur le dernier run
  // (uniquement parmi les prompts où Snapdesk est effectivement cité).
  const sentimentBreakdown = db
    .prepare(
      `
      SELECT snapdesk_sentiment AS sentiment, COUNT(*) AS count
      FROM results
      WHERE run_at = ? AND snapdesk_mentioned = 1
      GROUP BY snapdesk_sentiment
    `
    )
    .all(latestRun);

  res.json({ run_at: latestRun, byEngine, topCompetitors, sentimentBreakdown });
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

// GET /api/export.csv?run_at=...
// Export brut de la table results en CSV, pour partager/analyser en dehors du
// dashboard. Sans run_at : exporte tout l'historique.
const CSV_COLUMNS = [
  "id",
  "run_at",
  "engine",
  "prompt_id",
  "prompt_category",
  "prompt_text",
  "snapdesk_mentioned",
  "snapdesk_position",
  "snapdesk_sentiment",
  "geo_score",
  "competitors_mentioned",
  "raw_response",
  "error",
];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

app.get("/api/export.csv", (req, res) => {
  const { run_at } = req.query;
  let query = "SELECT * FROM results WHERE 1=1";
  const params = [];
  if (run_at) {
    query += " AND run_at = ?";
    params.push(run_at);
  }
  query += " ORDER BY run_at ASC, prompt_id ASC, engine ASC";
  const rows = db.prepare(query).all(...params);

  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvEscape(row[col])).join(","));
  }

  const filename = `geo-monitor-export${run_at ? "-" + run_at.slice(0, 10) : ""}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

app.listen(PORT, () => {
  console.log(`API de résultats disponible sur http://localhost:${PORT}`);
});
