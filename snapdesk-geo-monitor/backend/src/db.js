// db.js
// Gère la base de données. Même client (@libsql/client) pour les deux cas :
//  - en local, sans TURSO_DATABASE_URL : un simple fichier SQLite
//    (backend/data.sqlite), comme avant, aucun compte requis.
//  - en prod (le run hebdo tourne sur GitHub Actions) : la base Turso
//    hébergée, pour que Vercel puisse lire les mêmes données pour le
//    dashboard (voir frontend/lib/db.js et le README pour la mise en place).
// Chaque exécution du monitoring ajoute des lignes dans la table "results".

import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDbPath = path.join(__dirname, "..", "data.sqlite");

export const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : { url: `file:${localDbPath}` }
);

await db.execute(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT NOT NULL,           -- date/heure de l'exécution (ISO)
    engine TEXT NOT NULL,           -- 'chatgpt' | 'claude' | 'google_ai_overview' | 'gemini'
    prompt_id INTEGER NOT NULL,     -- référence vers config/prompts.json
    prompt_category TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    raw_response TEXT,              -- réponse brute de l'IA (peut être vide si pas d'AI Overview)
    snapdesk_mentioned INTEGER NOT NULL, -- 0 ou 1
    snapdesk_position INTEGER,      -- position d'apparition de Snapdesk parmi les acteurs cités (1 = premier cité), NULL si pas cité
    competitors_mentioned TEXT,     -- liste JSON des concurrents cités dans la réponse
    error TEXT                      -- message d'erreur éventuel (ex: quota dépassé)
  );
`);

// Migrations additives (idempotentes) pour les bases créées avant l'ajout du
// scoring sentiment — évite de casser les bases déjà existantes.
async function ensureColumn(table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  if (!rows.some((c) => c.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
await ensureColumn("results", "snapdesk_sentiment", "TEXT"); // 'positive' | 'neutral' | 'negative' | NULL si pas cité
await ensureColumn("results", "geo_score", "REAL"); // score 0-100 combinant présence + rang + sentiment, voir score.js

export async function insertResult(row) {
  await db.execute({
    sql: `
      INSERT INTO results (
        run_at, engine, prompt_id, prompt_category, prompt_text,
        raw_response, snapdesk_mentioned, snapdesk_position, snapdesk_sentiment,
        geo_score, competitors_mentioned, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      row.run_at,
      row.engine,
      row.prompt_id,
      row.prompt_category,
      row.prompt_text,
      row.raw_response,
      row.snapdesk_mentioned,
      row.snapdesk_position,
      row.snapdesk_sentiment,
      row.geo_score,
      row.competitors_mentioned,
      row.error,
    ],
  });
}
