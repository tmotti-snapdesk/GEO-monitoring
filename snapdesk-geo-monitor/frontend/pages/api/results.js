// GET /api/results?run_at=...&engine=...
// Détail brut (utile pour aller inspecter une réponse précise dans le dashboard).

import { db } from "../../lib/db";

export default async function handler(req, res) {
  try {
    const { run_at, engine } = req.query;
    let sql = "SELECT * FROM results WHERE 1=1";
    const args = [];
    if (run_at) {
      sql += " AND run_at = ?";
      args.push(run_at);
    }
    if (engine) {
      sql += " AND engine = ?";
      args.push(engine);
    }
    sql += " ORDER BY prompt_id ASC";

    const { rows } = await db.execute({ sql, args });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
