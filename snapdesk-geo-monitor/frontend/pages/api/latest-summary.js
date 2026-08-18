// GET /api/latest-summary
// Pour le run le plus récent : une synthèse globale (tous moteurs confondus,
// sur l'ensemble des 100 prompts) — c'est LE chiffre à suivre — puis le détail
// par moteur, le classement des concurrents et la répartition du sentiment.

import { db } from "../../lib/db";

export default async function handler(req, res) {
  try {
    const { rows: latestRunRows } = await db.execute(
      `SELECT MAX(run_at) AS run_at FROM results`
    );
    const latestRun = latestRunRows[0]?.run_at;

    if (!latestRun) {
      return res.json({
        run_at: null,
        overall: null,
        byEngine: [],
        topCompetitors: [],
        sentimentBreakdown: [],
      });
    }

    // Synthèse globale : un seul score de citation et un seul score GEO pour
    // l'ensemble du run (les 100 prompts x les moteurs activés), pas un par moteur.
    const { rows: overallRows } = await db.execute({
      sql: `
        SELECT
          COUNT(*) AS total_results,
          SUM(snapdesk_mentioned) AS total_mentions,
          AVG(geo_score) AS avg_geo_score
        FROM results
        WHERE run_at = ?
      `,
      args: [latestRun],
    });
    const overallRow = overallRows[0];

    const { rows: byEngineRaw } = await db.execute({
      sql: `
        SELECT
          engine,
          COUNT(*) AS total_prompts,
          SUM(snapdesk_mentioned) AS snapdesk_mentions,
          AVG(geo_score) AS avg_geo_score
        FROM results
        WHERE run_at = ?
        GROUP BY engine
      `,
      args: [latestRun],
    });
    const byEngine = byEngineRaw.map((r) => ({
      ...r,
      citation_rate: r.total_prompts
        ? Math.round((r.snapdesk_mentions / r.total_prompts) * 1000) / 10
        : 0,
      avg_geo_score: r.avg_geo_score ? Math.round(r.avg_geo_score * 10) / 10 : 0,
    }));

    const { rows: allRows } = await db.execute({
      sql: `SELECT competitors_mentioned FROM results WHERE run_at = ?`,
      args: [latestRun],
    });
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
    const { rows: sentimentBreakdown } = await db.execute({
      sql: `
        SELECT snapdesk_sentiment AS sentiment, COUNT(*) AS count
        FROM results
        WHERE run_at = ? AND snapdesk_mentioned = 1
        GROUP BY snapdesk_sentiment
      `,
      args: [latestRun],
    });

    // Score de sentiment global (0-100), synthèse de TOUTES les mentions du run
    // (tous moteurs confondus) : positif = 100, neutre = 50, négatif = 0, moyenné.
    // null si Snapdesk n'a été cité nulle part sur ce run (rien à évaluer).
    const SENTIMENT_POINTS = { positive: 100, neutral: 50, negative: 0 };
    let sentimentPointsSum = 0;
    let sentimentTotal = 0;
    for (const s of sentimentBreakdown) {
      if (s.sentiment in SENTIMENT_POINTS) {
        sentimentPointsSum += SENTIMENT_POINTS[s.sentiment] * s.count;
        sentimentTotal += s.count;
      }
    }

    const overall = {
      total_results: overallRow.total_results,
      total_mentions: overallRow.total_mentions || 0,
      citation_rate: overallRow.total_results
        ? Math.round((overallRow.total_mentions / overallRow.total_results) * 1000) / 10
        : 0,
      geo_score: overallRow.avg_geo_score
        ? Math.round(overallRow.avg_geo_score * 10) / 10
        : 0,
      sentiment_score: sentimentTotal
        ? Math.round((sentimentPointsSum / sentimentTotal) * 10) / 10
        : null,
    };

    res.json({ run_at: latestRun, overall, byEngine, topCompetitors, sentimentBreakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
