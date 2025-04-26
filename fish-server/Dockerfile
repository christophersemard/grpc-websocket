FROM node:23-alpine

# Création du répertoire de travail
WORKDIR /app

# Copie des fichiers nécessaires
COPY package*.json ./
COPY tsconfig.json ./
COPY proto ./proto
COPY index.ts ./

# Installation des dépendances
RUN npm install

# Compilation TypeScript
RUN npx tsc index.ts --outDir dist
RUN mkdir -p dist/proto && cp proto/*.proto dist/proto/

# Lancement du service
CMD ["node", "dist/index.js"]