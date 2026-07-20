# Imagem do front em dois modos, escolhidos pelo `target` do compose:
#   development -> servidor de dev do Vite       (docker-compose.yml)
#   production  -> build estático servido pelo nginx, que também faz o proxy
#                  reverso de /api para a API     (docker-compose.prod.yml)

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# --- desenvolvimento ---
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# --- build: gera os estáticos ---
# ATENÇÃO: o Vite inlina as variáveis VITE_* em tempo de BUILD, não de execução.
# Por isso a URL da API entra como ARG e precisa ser passada na construção da
# imagem — defini-la só no `environment` do compose não teria efeito nenhum.
FROM base AS build
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm ci
COPY . .
RUN npm run build

# --- produção: nginx servindo os estáticos + proxy reverso ---
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
