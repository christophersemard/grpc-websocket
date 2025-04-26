

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

Chaque scénario a été testé pendant 10 secondes après stabilisation du nombre de poissons.

| Scénario | Protocole | Moyenne | Médiane | P10 | P90 | Écart-type | Min | Max |
|:---|:---|---:|---:|---:|---:|---:|---:|---:|
| 100 poissons / 100ms | WebSocket | <span style="color:green;font-weight:bold;">1 ms</span> | <span style="color:green;font-weight:bold;">1 ms</span> | <span style="color:green;font-weight:bold;">0 ms</span> | <span style="color:green;font-weight:bold;">1 ms</span> | <span style="color:green;font-weight:bold;">0 ms</span> | <span style="color:green;font-weight:bold;">0 ms</span> | <span style="color:green;font-weight:bold;">2 ms</span> |
| | gRPC | <span style="color:green;font-weight:bold;">5 ms</span> | <span style="color:green;font-weight:bold;">5 ms</span> | <span style="color:green;font-weight:bold;">4 ms</span> | <span style="color:green;font-weight:bold;">6 ms</span> | <span style="color:green;font-weight:bold;">1 ms</span> | <span style="color:green;font-weight:bold;">2 ms</span> | <span style="color:green;font-weight:bold;">10 ms</span> |

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
- 

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
- **Tests avec charge réseau simulée** (latence artificielle, pertes de paquets) pour évaluer la robustesse de chaque protocole dans des conditions dégradées.
- **Optimiser les données** et leur type envoyées

---

## Conclusion

Aucune technologie n’est "meilleure" dans l’absolu, tout dépend **du contexte** et **des contraintes du projet**.

- Si on vise un **affichage temps réel dans un navigateur**, avec peu de clients, **WebSocket est idéal** car simple à mettre en place.
- Pour **des systèmes distribués**, **des infrastructures à forte charge**, ou **des communications entre serveurs**, **gRPC offre une robustesse, une fiabilité et une scalabilité supérieures**.

Ce projet permet de tester les **forces et limites réelles** de ces technos, et surtout, de comprendre **à quel moment il faut utiliser l’une ou l’autre**.

**En résumé :**  
- **WebSocket** brille par sa **simplicité** pour le **temps réel léger** côté navigateur.  
- **gRPC** s'impose par sa **rigueur** et sa **résilience** dans des architectures **plus exigeantes**.
