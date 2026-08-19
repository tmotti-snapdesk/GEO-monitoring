// GET /api/export.csv?run_at=...
// Export brut de la table results en CSV, pour partager/analyser en dehors du
// dashboard. Sans run_at : exporte tout l'historique.

import { db } from "../../lib/db";

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

export default async function handler(req, res) {
  try {
    const { run_at } = req.query;
    let sql = "SELECT * FROM results WHERE 1=1";
    const args = [];
    if (run_at) {
      sql += " AND run_at = ?";
      args.push(run_at);
    }
    sql += " ORDER BY run_at ASC, prompt_id ASC, engine ASC";

    const { rows } = await db.execute({ sql, args });

    const lines = [CSV_COLUMNS.join(",")];
    for (const row of rows) {
      lines.push(CSV_COLUMNS.map((col) => csvEscape(row[col])).join(","));
    }

    const filename = `geo-monitor-export${run_at ? "-" + run_at.slice(0, 10) : ""}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(lines.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
