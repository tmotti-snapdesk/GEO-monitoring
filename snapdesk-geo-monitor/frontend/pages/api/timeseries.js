// GET /api/timeseries
// Renvoie, pour chaque date de run et chaque moteur, le taux de citation de
// Snapdesk (en %) et le score GEO moyen sur l'ensemble des prompts testés ce
// jour-là.

import { db } from "../../lib/db";

export default async function handler(req, res) {
  try {
    const { rows } = await db.execute(`
      SELECT
        run_at,
        engine,
        COUNT(*) AS total_prompts,
        SUM(snapdesk_mentioned) AS snapdesk_mentions,
        AVG(geo_score) AS avg_geo_score
      FROM results
      GROUP BY run_at, engine
      ORDER BY run_at ASC
    `);

    const withRate = rows.map((r) => ({
      ...r,
      citation_rate: r.total_prompts
        ? Math.round((r.snapdesk_mentions / r.total_prompts) * 1000) / 10
        : 0,
      avg_geo_score: r.avg_geo_score ? Math.round(r.avg_geo_score * 10) / 10 : 0,
    }));

    res.json(withRate);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
