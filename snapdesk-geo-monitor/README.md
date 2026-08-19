# Snapdesk GEO Monitor

Outil de suivi de la visibilité de **Snapdesk** dans les réponses des moteurs
IA (ChatGPT, Claude, Google AI Overview, Gemini), face aux concurrents directs
(WeWork, Wojo, Morning, Spaces, Kwerk, Deskeo, Come and Work, Sora, LNB) et
indirects (Flashoffice, OfficeRiders, Spliit, Ubiq, JLL, Leaseo), sur 100
requêtes représentatives du marché des bureaux flexibles à Paris intramuros.

## Comment ça marche, en une phrase

Un script Node.js pose les 100 questions aux moteurs activés (ChatGPT, Claude,
Google AI Overview via SerpApi, et/ou Gemini — voir `ENGINES_ENABLED` plus bas)
— tous avec un accès web en direct, pour coller à ce qu'un vrai utilisateur
voit aujourd'hui — regarde si "Snapdesk" apparaît dans chaque réponse et à
quelle position, et stocke tout dans une base de données (un fichier SQLite en
local, ou [Turso](https://turso.tech) en production — même code des deux
côtés, voir "Déploiement" plus bas). Un site Next.js affiche l'évolution de
ces chiffres dans un dashboard, et sert aussi l'API qui lit ces résultats.

En prod, le run hebdomadaire tourne sur **GitHub Actions** (gratuit, pas de
serveur à gérer) plutôt qu'en continu quelque part : Vercel n'est pas adapté à
un job de plusieurs minutes ni à un fichier qui doit persister, voir
"Déploiement".

### Google AI Overview vs Gemini : deux surfaces différentes

Ce sont deux choses distinctes, toutes les deux utiles mais pas
interchangeables :

- **Google AI Overview** (`engines/serpapi.js`, via un compte SerpApi) : le
  résumé généré par IA qui apparaît en haut des résultats de recherche
  Google classique — la surface avec le plus de volume pour ce type de
  recherche, mais qui demande un compte SerpApi (gratuit à 100 requêtes/mois).
- **Gemini** (`engines/gemini.js`, via une clé Google AI Studio) : le chatbot
  Gemini interrogé directement, comme ChatGPT/Claude. API officielle simple à
  obtenir, mais mesure un usage différent (le chatbot, pas la recherche Google).

Si tu n'as pas encore de compte SerpApi, tu peux démarrer avec Gemini (clé
gratuite sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
et ajouter Google AI Overview plus tard sans rien casser.

## Méthodologie : pourquoi les résultats ne sont pas biaisés par un historique

Chaque appel à ChatGPT et Claude (`backend/src/engines/openai.js` et
`anthropic.js`) est **une requête API strictement sans état** : un seul
message utilisateur (le prompt), sans aucun message système, sans historique
de conversation, sans "mémoire" de compte. Concrètement :

- La fonctionnalité "Mémoire" de ChatGPT/Claude (qui retient des infos d'une
  conversation à l'autre) n'existe que dans les applis grand public (chat.openai.com,
  claude.ai) liées à un compte utilisateur — elle ne s'applique pas quand on
  appelle l'API brute comme le fait ce script, quelle que soit la clé API utilisée.
- Chaque prompt du run est envoyé dans un appel API totalement indépendant :
  le modèle ne "voit" ni les 99 autres prompts du même run, ni les runs
  précédents, ni aucune conversation passée sur la clé API utilisée.
- Aucun prompt système n'oriente le modèle vers Snapdesk ou le contexte de ce
  monitoring — les 100 prompts sont posés "à froid", comme le ferait un
  prospect anonyme qui découvre le sujet.
- Côté OpenAI, `store: false` est explicitement passé pour éviter que ces
  échanges (qui contiennent de l'intelligence concurrentielle) soient
  conservés côté OpenAI au-delà du traitement de la requête.

Deux nuances à garder en tête, différentes d'un "biais d'historique" :

- **Bruit statistique** : deux appels identiques peuvent renvoyer des réponses
  légèrement différentes (température par défaut du modèle, et maintenant
  aussi la variabilité des résultats de recherche web à l'instant T) — c'est
  normal et représentatif de ce que verrait un vrai utilisateur. La lecture
  fiable se fait sur la tendance dans le temps (plusieurs runs), pas sur un
  run isolé.
- **Recherche web activée sur les 3 moteurs** : ChatGPT (`gpt-4o-search-preview`),
  Claude (outil `web_search` côté serveur) et Google AI Overview (via SerpApi)
  interrogent tous les 3 le web en direct, avec une localisation Paris/France
  alignée entre les trois. Aucun des 3 n'utilise de compte connecté /
  personnalisé — donc pas de personnalisation liée à un historique de
  recherche ou de navigation individuel, seulement la variabilité normale
  d'une recherche web "à froid" à l'instant du run.
- **Rupture de série à surveiller** : le passage de "connaissance brute" à
  "recherche web activée" pour ChatGPT/Claude change ce qui est mesuré. Si tu
  avais déjà des runs historiques réalisés avant ce changement, attends-toi à
  une possible marche (hausse ou baisse) sur le graphique le jour du switch —
  ce n'est pas une vraie variation de visibilité, juste un changement de
  méthodologie. Idéalement, note la date de bascule quelque part pour ne pas
  la lire comme un événement business.

## Structure du projet

```
snapdesk-geo-monitor/
├── backend/              → Node.js : interroge les IA, écrit les résultats
│   ├── config/
│   │   ├── prompts.json      → les 100 questions testées
│   │   └── competitors.json  → la liste des concurrents à détecter
│   ├── src/
│   │   ├── engines/          → un fichier par moteur IA interrogé
│   │   ├── analyze.js        → détecte les mentions de Snapdesk/concurrents
│   │   ├── sentiment.js      → juge le ton des mentions de Snapdesk
│   │   ├── score.js          → calcule le score GEO combiné
│   │   ├── db.js             → connexion à la base (fichier local ou Turso)
│   │   ├── run.js            → lance UN cycle de monitoring complet
│   │   └── seed-demo-data.js → génère des données fictives pour prévisualiser le dashboard
│   └── .env.example          → à copier en .env avec tes vraies clés
└── frontend/             → Next.js : le dashboard + l'API qui lit les résultats
    ├── lib/db.js              → connexion en lecture à la même base
    └── pages/
        ├── index.js               → la page unique du dashboard
        └── api/                   → routes API (timeseries, latest-summary, results, export.csv)

.github/workflows/geo-monitor.yml  → déclenche `run.js` chaque lundi (voir "Déploiement")
```

Il n'y a plus de serveur Express séparé : le dashboard Next.js sert aussi
l'API (routes dans `frontend/pages/api/`), ce qui simplifie le dev local (un
seul `npm run dev`) et correspond à ce que Vercel héberge nativement.

## Installation (à faire une seule fois)

Tu as besoin de [Node.js](https://nodejs.org/) installé sur ta machine
(version 18 ou plus récente). Une fois que c'est fait :

```bash
# 1. Installer les dépendances du backend (le script qui interroge les IA)
cd backend
npm install
cp .env.example .env
# → ouvre .env et colle tes vraies clés API (OpenAI, Anthropic, SerpApi, Gemini)
# → si tu n'as pas encore toutes les clés, limite les moteurs testés avec
#   ENGINES_ENABLED (ex: ENGINES_ENABLED=claude,gemini)
# → TURSO_DATABASE_URL / TURSO_AUTH_TOKEN restent vides pour l'instant : en
#   local, sans ces 2 variables, tout est stocké dans backend/data.sqlite

# 2. Installer les dépendances du frontend (dashboard + API)
cd ../frontend
npm install
```

## Voir le dashboard sans dépenser un centime (données de démo)

```bash
cd backend
npm run seed-demo   # génère 4 runs fictifs dans backend/data.sqlite
cd ../frontend
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). Utile pour prévisualiser
l'UI ou vérifier que tout tourne après un changement, sans appeler les
vraies API.

## Lancer un premier vrai test (recommandé avant de tout lancer sur 100 prompts)

Ouvre `backend/src/run.js` et change temporairement :

```js
const START_INDEX = 0;
const END_INDEX = 5; // au lieu de promptsData.length
```

Puis :

```bash
cd backend
npm run run-once
```

Regarde dans le terminal qu'il n'y a pas d'erreur (clé API invalide, quota
dépassé, etc.), puis remets `END_INDEX = promptsData.length` pour repasser sur
les 100 prompts complets. Une fois lancé, `cd frontend && npm run dev` pour
voir les vrais résultats (il lit le même `backend/data.sqlite`).

## Déploiement (Vercel + GitHub Actions + Turso)

Le dashboard va sur Vercel, mais le run hebdomadaire (plusieurs minutes,
beaucoup d'appels API) ne rentre pas dans une fonction serverless Vercel — il
tourne donc sur GitHub Actions à la place, et écrit dans une base Turso que
Vercel lit ensuite en lecture seule.

**1. Créer la base Turso**

```bash
# Installe le CLI Turso (voir docs.turso.tech si la commande diffère) :
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create snapdesk-geo-monitor
turso db show snapdesk-geo-monitor --url        # → TURSO_DATABASE_URL
turso db tokens create snapdesk-geo-monitor      # → TURSO_AUTH_TOKEN
```

**2. Configurer GitHub Actions** (le run hebdomadaire)

Dans les Settings du repo GitHub > *Secrets and variables* > *Actions* :
- **Secrets** (sensibles) : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SERPAPI_API_KEY`, `GEMINI_API_KEY`.
- **Variables** (optionnel, non sensibles) : `ENGINES_ENABLED`,
  `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `ANTHROPIC_SENTIMENT_MODEL`, `GEMINI_MODEL`
  si tu veux surcharger les valeurs par défaut du code.

Le workflow (`.github/workflows/geo-monitor.yml`) tourne automatiquement tous
les lundis à 6h UTC. Pour tester sans attendre : onglet **Actions** du repo >
"GEO Monitor - run hebdomadaire" > **Run workflow**.

**3. Déployer le dashboard sur Vercel**

- Importe le repo dans Vercel, avec **Root Directory = `snapdesk-geo-monitor/frontend`**
  (c'est un monorepo, Vercel doit savoir où est l'app Next.js).
- Ajoute les variables d'environnement `TURSO_DATABASE_URL` et
  `TURSO_AUTH_TOKEN` (mêmes valeurs que les secrets GitHub) dans les
  paramètres du projet Vercel.
- Déploie. Le dashboard lit directement la base Turso — pas besoin de
  redéployer après chaque run GitHub Actions, les nouvelles données
  apparaissent au prochain chargement de page.

## Coûts à prévoir

- **OpenAI / Anthropic** : coût par token + un coût additionnel par recherche
  web effectuée (ChatGPT et Claude ont maintenant un accès web activé par
  défaut, voir "Méthodologie" plus haut). Vérifie les tarifs à jour sur
  platform.openai.com/pricing et anthropic.com/pricing avant un premier run
  complet — c'est plus cher qu'en mode "connaissance brute" (l'ancien
  comportement, toujours disponible en repassant `OPENAI_MODEL=gpt-4o` et en
  retirant l'outil `web_search` dans `anthropic.js`).
- **SerpApi** : le plan gratuit inclut 100 requêtes/mois — donc tout juste 1
  run complet par mois. Pour un run hebdomadaire sur les 100 prompts, il
  faudra passer sur un plan payant.
- **Turso / GitHub Actions / Vercel** : gratuits à ce volume (un run hebdo de
  quelques centaines de lignes en base, un job de quelques minutes par
  semaine, un dashboard à faible trafic).

## Score GEO et sentiment

En plus du simple taux de citation, chaque résultat individuel (un prompt x
un moteur) calcule :

- **`snapdesk_sentiment`** : quand Snapdesk est cité, Claude évalue le ton du
  passage (`positive` / `neutral` / `negative`) — voir `backend/src/sentiment.js`.
  Pas d'appel supplémentaire quand Snapdesk n'est pas cité, pour limiter les coûts.
- **`geo_score`** (0 à 100) : combine présence + rang d'apparition + sentiment
  pour ce résultat précis (voir `backend/src/score.js` pour le détail du calcul).

Ces deux métriques par résultat ne sont que la brique de base : **le chiffre à
suivre est la synthèse globale du run**, calculée par `/api/latest-summary`
dans son champ `overall` (tous moteurs et 100 prompts confondus, pas un score
par moteur) :

- `overall.geo_score` : moyenne du `geo_score` sur l'ensemble du run.
- `overall.sentiment_score` : moyenne pondérée du sentiment sur toutes les
  mentions du run (positif = 100, neutre = 50, négatif = 0), `null` si Snapdesk
  n'a été cité nulle part.
- `overall.citation_rate` : taux de citation global.

C'est cette synthèse qui s'affiche en gros en haut du dashboard ; le détail
par moteur (`byEngine`) reste disponible juste en dessous, à titre de
complément.

Le dashboard affiche aussi la répartition du sentiment des mentions du
dernier run, et un bouton **Exporter en CSV** (endpoint `GET /api/export.csv`,
avec un paramètre optionnel `?run_at=...` pour un seul run) qui télécharge
les résultats bruts.

## Pour aller plus loin (idées d'amélioration futures)

- **Alertes** : envoyer un message Slack/email si le taux de citation ou le
  score GEO chute fortement d'une semaine à l'autre.
- **Variantes de prompts** : reformuler automatiquement chaque prompt (via un
  LLM) pour tester plusieurs façons de poser la même question, plus robuste
  qu'une liste figée de 100 prompts.
- **Protection de l'API** : les routes `frontend/pages/api/*` n'ont pas
  d'authentification — une fois sur Vercel, `/api/export.csv` (qui contient
  les réponses brutes des IA, donc de l'intelligence concurrentielle) est
  accessible à qui a l'URL. À ajouter avant un usage sensible : protection
  Vercel (mot de passe au niveau du projet) ou vérification d'un header/token
  secret dans les routes API elles-mêmes.

## Où sont mes 100 prompts et ma liste de concurrents ?

Dans `backend/config/prompts.json` et `backend/config/competitors.json` — ce
sont de simples fichiers texte, modifiables directement (ajoute, retire ou
reformule des questions librement, aucune compétence en code n'est requise
pour éditer un fichier JSON, juste respecter les guillemets et les virgules).
