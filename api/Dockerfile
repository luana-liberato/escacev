FROM node:20-alpine

WORKDIR /app

# Instala OpenSSL (necessário para o Prisma funcionar corretamente no Alpine)
RUN apk add --no-cache openssl

# Instala dependências
COPY package*.json ./
RUN npm install

# Gera o Prisma Client (precisa do schema)
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante do código
COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
