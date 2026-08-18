// db.js
// Gère la base de données locale (SQLite = une simple base de données stockée
// dans un fichier, pas besoin d'installer de serveur de base de données à part).
// Chaque exécution du monitoring ajoute des lignes dans la table "results".

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data.sqlite");

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT NOT NULL,           -- date/heure de l'exécution (ISO)
    engine TEXT NOT NULL,           -- 'chatgpt' | 'claude' | 'google_ai_overview'
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
// scoring sentiment — évite de casser les data.sqlite déjà existants.
function ensureColumn(table, column, type) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
ensureColumn("results", "snapdesk_sentiment", "TEXT"); // 'positive' | 'neutral' | 'negative' | NULL si pas cité
ensureColumn("results", "geo_score", "REAL"); // score 0-100 combinant présence + rang + sentiment, voir score.js

export function insertResult(row) {
  const stmt = db.prepare(`
    INSERT INTO results (
      run_at, engine, prompt_id, prompt_category, prompt_text,
      raw_response, snapdesk_mentioned, snapdesk_position, snapdesk_sentiment,
      geo_score, competitors_mentioned, error
    ) VALUES (
      @run_at, @engine, @prompt_id, @prompt_category, @prompt_text,
      @raw_response, @snapdesk_mentioned, @snapdesk_position, @snapdesk_sentiment,
      @geo_score, @competitors_mentioned, @error
    )
  `);
  stmt.run(row);
}
