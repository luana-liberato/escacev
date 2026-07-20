# Imagem da API em dois modos, escolhidos pelo `target` do compose:
#   development -> ts-node-dev em watch      (docker-compose.yml)
#   production  -> JS compilado, sem devDeps (docker-compose.prod.yml)

FROM node:20-alpine AS base
WORKDIR /app
# Instala OpenSSL (necessário para o Prisma funcionar corretamente no Alpine)
RUN apk add --no-cache openssl
COPY package*.json ./

# --- desenvolvimento: dependências completas + recarga automática ---
FROM base AS development
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# --- build: compila o TypeScript e gera o client do Prisma ---
# É também o alvo do serviço `migrate` do compose de produção: este é o único
# estágio que tem o CLI do Prisma, que é devDependency.
FROM base AS build
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# --- produção: só o necessário para rodar ---
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY prisma ./prisma
# O client gerado vem do estágio de build: sem o CLI do Prisma aqui, `prisma
# generate` não teria como rodar nesta imagem.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
