# Snapdesk GEO Monitor

Outil de suivi de la visibilité de **Snapdesk** dans les réponses des moteurs
IA (ChatGPT, Claude, Google AI Overview), face aux concurrents directs
(WeWork, Wojo, Morning, Spaces, Kwerk, Deskeo, Come and Work, Sora, LNB) et
indirects (Flashoffice, OfficeRiders, Spliit, Ubiq, JLL, Leaseo), sur 100
requêtes représentatives du marché des bureaux flexibles à Paris intramuros.

## Comment ça marche, en une phrase

Un script Node.js pose les 100 questions à ChatGPT, Claude et Google (via
SerpApi) — les 3 avec un accès web en direct, pour coller à ce qu'un vrai
utilisateur voit aujourd'hui — regarde si "Snapdesk" apparaît dans chaque
réponse et à quelle position, stocke tout dans un fichier de base de données
local (`backend/data.sqlite`), et un site Next.js affiche l'évolution de ces
chiffres dans un dashboard.

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
├── backend/              → Node.js : interroge les IA, stocke, expose une API
│   ├── config/
│   │   ├── prompts.json      → les 100 questions testées
│   │   └── competitors.json  → la liste des concurrents à détecter
│   ├── src/
│   │   ├── engines/          → un fichier par moteur IA interrogé
│   │   ├── analyze.js        → détecte les mentions de Snapdesk/concurrents
│   │   ├── db.js             → base de données locale (SQLite)
│   │   ├── run.js            → lance UN cycle de monitoring complet
│   │   ├── scheduler.js      → lance run.js automatiquement chaque semaine
│   │   └── api.js            → petit serveur qui sert les résultats au dashboard
│   └── .env.example          → à copier en .env avec tes vraies clés
└── frontend/             → Next.js : le dashboard visuel
    └── pages/index.js        → la page unique du dashboard
```

## Installation (à faire une seule fois)

Tu as besoin de [Node.js](https://nodejs.org/) installé sur ta machine
(version 18 ou plus récente). Une fois que c'est fait :

```bash
# 1. Installer les dépendances du backend
cd backend
npm install
cp .env.example .env
# → ouvre .env et colle tes vraies clés API (OpenAI, Anthropic, SerpApi)

# 2. Installer les dépendances du frontend
cd ../frontend
npm install
cp .env.local.example .env.local
```

## Lancer un premier test (recommandé avant de tout lancer sur 100 prompts)

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

Ça va poser les 5 premières questions aux 3 moteurs (15 appels API) et
enregistrer les résultats. Regarde dans le terminal qu'il n'y a pas d'erreur
(clé API invalide, quota dépassé, etc.), puis remets `END_INDEX =
promptsData.length` pour repasser sur les 100 prompts complets.

## Voir le dashboard

Il faut deux terminaux ouverts en même temps :

```bash
# Terminal 1 : l'API qui sert les résultats
cd backend
npm run api

# Terminal 2 : le dashboard
cd frontend
npm run dev
```

Puis ouvre [http://localhost:3000](http://localhost:3000) dans ton
navigateur.

## Lancer le monitoring complet (100 prompts x 3 moteurs)

```bash
cd backend
npm run run-once
```

Ça prend quelques minutes (300 appels API avec une petite pause entre chaque
pour rester tranquille avec les limites de débit). Une fois terminé, recharge
le dashboard : les nouveaux chiffres apparaissent.

## Automatiser (optionnel)

`npm run schedule` (dans `backend/`) lance un process qui reste actif et
déclenche automatiquement `run.js` tous les lundis à 6h. Ce process doit
tourner en continu quelque part — soit ta machine reste allumée, soit tu le
déploies sur un petit serveur (Railway, Render, un VPS...). Si tu préfères
rester simple, tu peux aussi juste lancer `npm run run-once` manuellement
chaque semaine, ou passer par une tâche planifiée de ton système
d'exploitation.

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
- **Protection de l'API** : `backend/src/api.js` n'a pas d'authentification
  ni de restriction CORS — à ajouter avant tout déploiement public.

## Où sont mes 100 prompts et ma liste de concurrents ?

Dans `backend/config/prompts.json` et `backend/config/competitors.json` — ce
sont de simples fichiers texte, modifiables directement (ajoute, retire ou
reformule des questions librement, aucune compétence en code n'est requise
pour éditer un fichier JSON, juste respecter les guillemets et les virgules).
