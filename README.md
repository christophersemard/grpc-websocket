

# 🐟 Aquarium

Une application permettant d'afficher en temps réél des poissons se déplaçant dans un aquarium et accessoirement de comparer le performances entre la communication WebSocket et gRPC.

---

## ⚙️ Prérequis

- **Docker + Docker Compose**

---

## 🚀 Lancer le projet avec Docker

1. Cloner le projet

```bash
git clone https://github.com/christophersemard/aquarium.git
cd grpc-websocket
```

2. Démarrer tous les services

```bash
docker-compose up --build
```

3. Accéder à l'application sur

```
http://localhost:3000 
```
pour la page d'accueil avec la modification de poisson et d'intervalle

```
http://localhost:3000/benchmark 
```
pour la page de benchmark automatique

---
## 🧠 Technologies utilisées

| Composant | Stack | Rôle |
|:----------|:------|:-----|
| Frontend | **Next.js 15**, **TypeScript**, **TailwindCSS**, **SSE**, **gRPC**, **WebSocket** | Il reçoit les données du serveur en WebSocket ou en SSE (via gRPC). Il affiche les poissons en temps réel et collecte les métriques de latence. |
| Serveur | **Node.js**, **gRPC**, **WebSocket**, **TypeScript** | Il génère les positions des poissons en continu et diffuse les mises à jour en temps réel aux clients à la fois via WebSocket et via gRPC. |
| Proto | **Fichier `.proto`** | Le fichier `.proto` définit les contrats d'interface gRPC pour l'envoi des `FishBatch` et la mise à jour dynamique de la configuration (nombre de poissons, intervalle d'envoi). |

---

## 📂 Structure du projet

```bash
.
├── anciens-benchmarks/                     # Scripts de benchmark (WebSocket & gRPC)
│
├── fish-frontend/                          # Interface utilisateur (Next.js)
│   ├── src/app/api/grpc/route.ts           # Route API SSE récupérant les données du serveur en gRPC
│   ├── src/hooks/useFishGrpc.ts            # Hook pour recevoir les poissons en temps réel via gRPC (SSE)
│   ├── src/hooks/useFishWebSocket.ts       # Hook pour recevoir les poissons en temps réel via WebSocket
│   ├── src/components/                     # Composants UI (Aquarium, MetricsPanel, etc.)
│   ├── src/app/page.tsx                    # Page principale de l'application
│   └── proto/fish.proto                    # Fichier gRPC proto (copie pour le frontend)
│
├── fish-server/                            # Génère et diffuse les poissons (gRPC & WebSocket)
│   ├── index.ts                            # Serveur principal
│   └── proto/fish.proto                    # Fichier gRPC proto (référence serveur)
│
├── docker-compose.yml                      # Compose pour orchestrer le serveur et le frontend
│
└── README.md                               # Documentation du projet
```


---

## 📡 Objectif du projet

On veut analyser, à notre niveau, l'utilisation de deux technologies afin d'envoyer des données en temps réél. Pour cela on va comparer le gRPC (+ SSE pour l'envoi au client) et le WebSocket.

### Ce qu’on veut observer ici :

- **La latence** : combien de temps s’écoule entre l’envoi et la réception d’une donnée ?
- **Le débit** : est-ce que des messages se perdent, à quelle vitesse peut-on recevoir les data ?
- **Le capacité de charge** : est-ce que ça crash ? Est-ce que les connexions tiennent ?

---

## Benchmarks effectués

Pour mieux comprendre les **performances** et les **latences** de chaque méthode (WebSocket et gRPC), j’ai mis en place un système de **tests automatisés** dans le dossier `benchmarks`.

Ces tests ne passent **pas du tout par le frontend**. Ils se connectent **directement au serveur**, pour mesurer uniquement ce qui se passe côté réseau et traitement — sans que l’interface utilisateur ou le navigateur influence les résultats. 

J'ai fait comme ceci les benchmarks, et non directement dans l'application frontend, car dans le cas d'utilisation du gRPC pour un affichage en frontend via un navigateur, on est toujours obligé d'avoir un serveur qui récupère la data puis la renvoie en SSE ou WebSocket vers notre navigateur. **On ne peut pas faire de gRPC natif via notre navigateur** ce qui est une grosse limite de ce protocole pour l'applicatif web.

### Objectif

Le but des ces tests est de connaître :

- La **latence moyenne** (temps entre l’envoi et la réception d’un message).
- La **médiane**, les **percentiles 10/90** pour mieux comprendre la distribution des latences.
- L'**écart-type** pour mesurer la stabilité.
- Le **nombre de poissons actifs** pour vérifier la robustesse.
- La comparaison entre **WebSocket** et **gRPC** dans des conditions équivalentes.

### Méthodologie

Pour tester notre applicatif et les différences entre les deux protocoles, j'ai décidé de créer un benchmark directement en frontend.

- Chaque scénario ajuste dynamiquement le **nombre de poissons** et la **fréquence d'envoi** via une API (`/api/config`).
- Avant de commencer les mesures, le benchmark **attend** que le nombre de poissons soit stabilisé.
- Ensuite, il **collecte les données** sur **WebSocket** et **gRPC** en parallèle.
- Les résultats sont **sauvegardés** et affichés dans un tableau de comparaison final.


## Limites

Durant ces tests je me suis heurté à plusieurs limites, notamment sur l'applicatif, coté frontend notamment où l'affichage des poissons ralentissait beaucoup l'application, chose que j'ai réussi à limiter en utilisant un canvas html.

On ne mesure pas l'effet de plusieurs clients connectés dans ce benchmark.

Note importante :
- En WebSocket, la connexion est directe entre frontend et serveur.
- En gRPC, le frontend utilise une **route API** qui établit une connexion gRPC serveur → frontend via **SSE**. Cela peut introduire une légère latence supplémentaire **propre au navigateur**.

On ne mesure pas l'usage CPU ou mémoire du serveur pendant les tests.

## Résultats du benchmark

| Scénario | Protocole | Moyenne | Médiane | P10 | P90 | Écart-type | Min | Max |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|
| 100 poissons / 100ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:green;">1 ms</span> | 1 ms | 1 ms | 2 ms | 0 ms | 1 ms | 2 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">2 ms</span> | 2 ms | 1 ms | 2 ms | 2 ms | 1 ms | 9 ms |
| 200 poissons / 50ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:green;">1 ms</span> | 1 ms | 1 ms | 2 ms | 1 ms | 1 ms | 4 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">3 ms</span> | 2 ms | 1 ms | 5 ms | 2 ms | 1 ms | 11 ms |
| 500 poissons / 30ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:green;">4 ms</span> | 2 ms | 1 ms | 9 ms | 3 ms | 1 ms | 12 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">6 ms</span> | 5 ms | 3 ms | 11 ms | 3 ms | 3 ms | 17 ms |
| 1000 poissons / 20ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:orange;">84 ms</span> | 81 ms | 67 ms | 104 ms | 16 ms | 21 ms | 108 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">18 ms</span> | 17 ms | 10 ms | 28 ms | 7 ms | 5 ms | 35 ms |
| 2500 poissons / 20ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:orange;">429 ms</span> | 102 ms | 71 ms | 1680 ms | 692 ms | 52 ms | 1857 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">36 ms</span> | 35 ms | 15 ms | 55 ms | 16 ms | 10 ms | 79 ms |
| 4000 poissons / 20ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:red;">8752 ms</span> | 8736 ms | 8516 ms | 9038 ms | 190 ms | 8403 ms | 8790 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:green;">23 ms</span> | 21 ms | 17 ms | 31 ms | 7 ms | 13 ms | 35 ms |
| 5000 poissons / 20ms | <span style="color:#3b82f6;font-weight:bold;">WebSocket</span> | <span style="color:red;">21388 ms</span> | 20478 ms | 20372 ms | 24824 ms | 1929 ms | 20343 ms | 26495 ms |
| | <span style="color:#10b981;font-weight:bold;">gRPC</span> | <span style="color:orange;">99 ms</span> | 100 ms | 64 ms | 135 ms | 26 ms | 52 ms | 158 ms |

## Ancien système de benchmark

Avant de passer au benchmark en frontend directement connecté, j'avais mis en place un **système de benchmark séparé** dans le dossier `anciens-benchmarks/`.

Ce système :
- Se connectait **directement** au serveur via WebSocket ou gRPC.
- Simulait un ou plusieurs clients pour mesurer :
  - La latence moyenne,
  - Le nombre de messages reçus,
  - Le taux de perte de messages,
  - Le comportement sous charge.

Cependant, ce benchmark avait plusieurs **limitations** :
- **Pas de prise en compte** de l'affichage frontend (qui impacte les performances en réalité).
- **Pas représentatif** de l'expérience utilisateur réelle dans un navigateur.
- **Ouverture d'un flux grpc pour chaque client**, ce qui n'est pas le cas en frontend puisque la partie serveur crée un seul flux puis l'envoie à tous les clients.


# Analyse des résultats

Les résultats montrent clairement que les deux protocoles fonctionnent très bien tant qu'on reste en dessous de **500 poissons**. La latence reste très basse (entre **1 et 11 ms**), et **stable**.  À ce niveau et cette charge, les deux protocoles semblent **assez identiques**.

Mais dès qu'on monte au-dessus de **500 poissons** on voit que le **WebSocket devient beaucoup plus lent**, beaucoup **moins stable**, et à partir de **2500 poissons** il n'est carrément **plus comparable** au **gRPC** qui reste **très stable**.

On voit donc que si on compare les deux protocoles avec **un seul client** pour chaque, **il n'y a pas photo** entre le WebSocket et le gRPC, le dernier étant bien plus efficace.

---

Mes anciens benchmarks avec plusieurs clients connectés m'ont quand même fait observer des choses intéressantes également :

- Avec **gRPC**, **tous les clients arrivent à se connecter** et **reçoivent leurs messages**. Mais la **latence augmente**, jusqu’à **plusieurs secondes** pour certains clients. Le souci est qu'ouvrir un flux gRPC par client demande des infrastructures bien plus complexes et efficaces, ce n'est pas viable d'ouvrir 500 flux gRPC sur un petit serveur Node.

- Avec **WebSocket**, un autre problème apparaît, certaines **connexions sont carrément refusées**. Cependant c'est beaucoup moins lourd d'ouvrir une connexion WebSocket qu'un nouveau flux gRPC.

---

Dès qu’on pousse trop loin, on atteint les **limites de mon implémentation actuelle**,  on peut quand même penser que **gRPC est un peu plus fiable et plus robuste** et supporte mieux une charge lourde sur un seul client, mais pour connecter beaucoup de clients il faudrait une implémentation bien plus optimisée.


# Avantages et inconvénients

### WebSocket

**✅ Avantages :**
- Fonctionne **directement dans les navigateurs**, sans passerelle supplémentaire en NodeJS
- **Simple à mettre en place** pour les développeurs peeu expérimentés
- Suffisant dans la **majorité des cas d'usage** si la charge est modérée.

**❌ Inconvénients :**
- **Moins typé** et structuré que gRPC (messages en JSON par défaut).
- Semble montrer ses **limites sur des charges lourdes**.
- **Facilité de lire les données interceptées** si on envoie des JSON.
- **Limites sur la stabilité** des connexion (refus de connexion notamment sur mes benchmarks)

**💡 Cas d’usage :**
- Interfaces **web en temps réel**
- Applications webs où **le navigateur doit recevoir des infos sans trop de délai**
- Projets simples à moyens où **l’échelle est contrôlée**

---

### gRPC

**✅ Avantages :**
- Très **rapide et optimisé**, surtout pour les communications **serveur à serveur**.
- Messages **fortement typés**, bien définis via des fichiers `.proto`, le contrat d'interface permet de ne pas pouvoir se tromper (en théorie).
- Semble avoir de meilleures performances à grande échelle.

**❌ Inconvénients :**
- **Pas utilisable directement dans les navigateurs** avec NodeJS, nécesite un serveur ou un proxy qui récupère les données avant de les envoyer au client autrement (SSE ou WebSocket). Ajoute une **latence supplémentaire** à cause de cette passerelle.
- Mise en place et debug **plus complexes** qu’un WebSocket simple au départ.
- **Plus compliqué pour l'applicatif d'ouvrir beaucoup de flux gRPC** que beaucoup de flux Websocket

**💡 Cas d’usage :**
- **Communication entre microservices**, c'est ce que j'utilise dans mon projet de fin d'année avec une Gateway exposée en HTTP et mes microservices derrière qui communiquent en gRPC avec la Gateway.
- **Applications critiques** où la **performance serveur** est prioritaire (ex: banque, industrie).
- Scénarios avec **beaucoup de clients connectés en même temps**.
- Exemple concret : dans notre projet Twitch de cours, on avait constaté que **gRPC était beaucoup plus robuste pour transmettre l’état du stream**, mais **pas idéal pour envoyer de la vidéo**, d'autres protocoles sont faits pour ça (RTC)

---

## Améliorations possibles de notre application

- Déploiement sur **VPS** pour tester dans des conditions plus réalistes sur le réseau.
- Mise en place de plusieurs serveurs.
- **Séparation des serveurs** WebSocket et gRPC dans des processus ou containers distincts pour éviter qu'ils ne se pénalisent mutuellement.
- Ajout d’un **monitoring** (ex : Grafana) pour connaitre l'utilisation de ressources de l'application.
- **Tests avec charge réseau simulée** (latence artificielle, pertes de paquets) pour évaluer la robustesse de chaque protocole dans des conditions dégradées comme on avait vu en cours avec les logiciels de chaos engineering
- **Optimiser les données** et leur type envoyées

---

## Conclusion

Aucune technologie n’est "meilleure" dans l’absolu, tout dépend **du contexte** et **des contraintes du projet**.

- Si on vise un **affichage temps réel dans un navigateur**, avec peu de clients, **WebSocket est idéal** car simple à mettre en place.
- Pour **des systèmes distribués**, **des infrastructures à forte charge**, ou **des communications entre serveurs**, **gRPC offre une robustesse, une fiabilité et une scalabilité supérieures**.

Ce projet permet de tester les **forces et limites réelles** de ces technos, et surtout, de comprendre **à quel moment il faut utiliser l’une ou l’autre**.

**En résumé :**  
- **WebSocket** brille par sa **simplicité** pour le **temps réel léger** côté navigateur.  
- **gRPC** par sa **rigueur** et sa **résilience** dans des architectures **plus exigeantes**.
