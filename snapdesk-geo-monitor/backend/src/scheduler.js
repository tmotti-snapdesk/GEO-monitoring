// scheduler.js
// Lance automatiquement le monitoring selon un planning (par défaut : tous les
// lundis à 6h du matin). Ce script doit rester actif en permanence (sur un petit
// serveur, un Raspberry Pi, ou un service comme Railway/Render) pour que le cron
// se déclenche. Si tu préfères ne pas garder de process actif en permanence, tu
// peux aussi juste lancer "npm run run-once" manuellement ou via un cron système /
// une tâche planifiée Windows, sans passer par ce fichier.

import "dotenv/config";
import cron from "node-cron";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runOnce() {
  console.log(`[${new Date().toISOString()}] Lancement du monitoring planifié...`);
  const child = spawn("node", [path.join(__dirname, "run.js")], {
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    console.log(`[${new Date().toISOString()}] Monitoring terminé (code ${code}).`);
  });
}

// Tous les lundis à 6h00 (heure du serveur). Modifie cette expression cron si tu
// veux une autre fréquence : https://crontab.guru/ pour t'aider à la construire.
cron.schedule("0 6 * * 1", runOnce);

console.log("Planificateur démarré : le monitoring se lancera tous les lundis à 6h.");
console.log("Laisse ce process tourner (ou déploie-le sur un petit serveur).");
