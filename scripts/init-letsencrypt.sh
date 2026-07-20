#!/bin/sh
# Emissão do PRIMEIRO certificado. Rode UMA vez na VPS, depois do DNS de
# escacev.com já apontar para ela. As renovações são automáticas (serviço
# `certbot` do compose) — este script não precisa rodar de novo.
#
#   sh scripts/init-letsencrypt.sh
#
# Por que existe: há um impasse. O nginx não sobe sem os arquivos do
# certificado, porque a config os referencia; e o certbot não emite o
# certificado sem o nginx no ar para responder ao desafio HTTP. A saída é
# colocar um certificado FALSO no lugar só para o nginx conseguir subir, pedir o
# certificado de verdade por cima, e recarregar.
set -e

DOMAIN="escacev.com"
WWW_DOMAIN="www.escacev.com"
COMPOSE="docker compose -f docker-compose.prod.yml"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "ERRO: defina CERTBOT_EMAIL — o Let's Encrypt avisa nesse endereço se a"
  echo "renovação falhar e o certificado estiver perto de expirar."
  echo "Exemplo: CERTBOT_EMAIL=voce@gmail.com sh scripts/init-letsencrypt.sh"
  exit 1
fi

echo "==> 1/5 Certificado temporário, só para o nginx conseguir subir"
$COMPOSE run --rm --entrypoint "sh -c 'mkdir -p $CERT_PATH && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout $CERT_PATH/privkey.pem \
    -out $CERT_PATH/fullchain.pem \
    -subj \"/CN=$DOMAIN\"'" certbot

echo "==> 2/5 Subindo os serviços"
$COMPOSE up -d --build

echo "==> 3/5 Removendo o certificado temporário"
$COMPOSE run --rm --entrypoint "rm -rf /etc/letsencrypt/live/$DOMAIN \
  /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "==> 4/5 Pedindo o certificado real ao Let's Encrypt"
# --webroot: o certbot escreve o desafio num diretório que o nginx já serve em
# HTTP (o bloco /.well-known/acme-challenge/ da config, que não é redirecionado).
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --email $CERTBOT_EMAIL --agree-tos --no-eff-email \
  -d $DOMAIN -d $WWW_DOMAIN" certbot

echo "==> 5/5 Recarregando o nginx com o certificado real"
$COMPOSE exec web nginx -s reload

echo ""
echo "Pronto. Confira: https://$DOMAIN"
