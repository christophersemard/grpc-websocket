FROM node:23-alpine AS builder

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

FROM node:20

WORKDIR /app

COPY --from=builder /app .

EXPOSE 3000

CMD ["npm", "start"]
