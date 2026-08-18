// lib/db.js
// Connexion en LECTURE à la même base que backend/src/db.js (voir ce fichier
// pour le détail). Duplique volontairement la connexion + la création de
// table plutôt que d'importer depuis ../backend : Vercel ne build que le
// répertoire frontend/, un import qui sort de ce dossier casserait le
// déploiement. Les migrations de colonnes sont rejouées ici aussi (idempotent)
// pour que le dashboard ne plante pas si jamais il lit une base Turso toute
// neuve avant le premier run GitHub Actions.

import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En local, sans TURSO_DATABASE_URL : lit le même fichier que le backend
// (backend/data.sqlite), pour que "npm run seed-demo" et "npm run run-once"
// dans backend/ soient immédiatement visibles ici sans rien configurer.
const localDbPath = path.join(__dirname, "..", "..", "backend", "data.sqlite");

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
    run_at TEXT NOT NULL,
    engine TEXT NOT NULL,
    prompt_id INTEGER NOT NULL,
    prompt_category TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    raw_response TEXT,
    snapdesk_mentioned INTEGER NOT NULL,
    snapdesk_position INTEGER,
    competitors_mentioned TEXT,
    error TEXT
  );
`);

async function ensureColumn(table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  if (!rows.some((c) => c.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
await ensureColumn("results", "snapdesk_sentiment", "TEXT");
await ensureColumn("results", "geo_score", "REAL");
