import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ENGINE_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  google_ai_overview: "Google AI Overview",
};

const ENGINE_COLORS = {
  chatgpt: "#74aa9c",
  claude: "#d97757",
  google_ai_overview: "#4285f4",
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// Transforme les lignes plates de l'API en un format que recharts comprend :
// une entrée par date, avec une colonne par moteur.
function pivotTimeseries(rows) {
  const byDate = {};
  for (const row of rows) {
    const dateLabel = formatDate(row.run_at);
    if (!byDate[dateLabel]) byDate[dateLabel] = { date: dateLabel };
    byDate[dateLabel][row.engine] = row.citation_rate;
  }
  return Object.values(byDate);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/latest-summary`).then((r) => r.json()),
      fetch(`${API_URL}/api/timeseries`).then((r) => r.json()),
    ])
      .then(([summaryData, timeseriesData]) => {
        setSummary(summaryData);
        setTimeseries(pivotTimeseries(timeseriesData));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <h1>Snapdesk — Suivi GEO</h1>
      <p className="subtitle">
        Visibilité de Snapdesk dans ChatGPT, Claude et Google AI Overview, sur 100
        requêtes représentatives du marché des bureaux flexibles à Paris.
      </p>

      {loading && <p className="empty">Chargement des résultats...</p>}
      {error && (
        <p className="empty">
          Impossible de contacter l'API ({API_URL}). Vérifie que le backend
          tourne bien (`npm run api` dans le dossier backend). Détail : {error}
        </p>
      )}

      {!loading && !error && (!summary || !summary.run_at) && (
        <p className="empty">
          Aucun résultat pour l'instant. Lance un premier monitoring avec{" "}
          <code>npm run run-once</code> dans le dossier backend.
        </p>
      )}

      {summary && summary.run_at && (
        <>
          <div className="cards">
            {summary.byEngine.map((e) => (
              <div className="card" key={e.engine}>
                <div className="label">{ENGINE_LABELS[e.engine] || e.engine}</div>
                <div className="value">{e.citation_rate}%</div>
                <div className="label">
                  {e.snapdesk_mentions} / {e.total_prompts} prompts
                </div>
              </div>
            ))}
          </div>

          <div className="section">
            <h2>Évolution du taux de citation dans le temps</h2>
            {timeseries.length <= 1 ? (
              <p className="empty">
                Pas encore assez d'historique pour un graphique — reviens après le
                2e run.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262a33" />
                  <XAxis dataKey="date" stroke="#9a9ea6" />
                  <YAxis stroke="#9a9ea6" unit="%" />
                  <Tooltip
                    contentStyle={{ background: "#171a21", border: "1px solid #262a33" }}
                  />
                  <Legend />
                  {Object.keys(ENGINE_LABELS).map((engine) => (
                    <Line
                      key={engine}
                      type="monotone"
                      dataKey={engine}
                      name={ENGINE_LABELS[engine]}
                      stroke={ENGINE_COLORS[engine]}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="section">
            <h2>Concurrents les plus cités (dernier run)</h2>
            {summary.topCompetitors.length === 0 ? (
              <p className="empty">Aucun concurrent détecté sur ce run.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Concurrent</th>
                    <th>Nombre de citations</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topCompetitors.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
