#!/bin/sh
# Restaura o IP REAL do visitante quando o proxy do Cloudflare está ligado.
#
#   sudo sh deploy/cloudflare-realip.sh
#
# Com a nuvem laranja, quem conecta na VPS é o Cloudflare — o nginx passa a
# registrar o IP dele em todo acesso, e os logs perdem o valor. O Cloudflare
# manda o IP verdadeiro no cabeçalho CF-Connecting-IP; `set_real_ip_from` diz ao
# nginx em quais peers confiar para acreditar nesse cabeçalho.
#
# As faixas são BUSCADAS do Cloudflare em vez de fixadas aqui: elas mudam de
# tempos em tempos, e uma lista velha faz os acessos daquela faixa voltarem a
# registrar o IP do proxy, silenciosamente.
#
# Rode de novo se o Cloudflare anunciar faixas novas.
set -e

OUT="/etc/nginx/conf.d/cloudflare-realip.conf"
TMP="$(mktemp)"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: rode com sudo — o destino é $OUT"
  exit 1
fi

echo "==> Buscando as faixas de IP do Cloudflare"
{
  echo "# Gerado por deploy/cloudflare-realip.sh — não editar à mão."
  echo "# Faixas obtidas de https://www.cloudflare.com/ips-v4 e /ips-v6"
  echo ""
  curl -fsS https://www.cloudflare.com/ips-v4 | sed 's/^/set_real_ip_from /; s/$/;/'
  curl -fsS https://www.cloudflare.com/ips-v6 | sed 's/^/set_real_ip_from /; s/$/;/'
  echo ""
  echo "real_ip_header CF-Connecting-IP;"
} > "$TMP"

# Confere que veio conteúdo de verdade antes de sobrescrever: um curl que
# devolvesse vazio geraria um arquivo só com o cabeçalho, e o real_ip_header
# sem nenhum set_real_ip_from faria o nginx confiar em ninguém — os logs
# continuariam mostrando o IP do Cloudflare, sem erro nenhum.
if ! grep -q "^set_real_ip_from" "$TMP"; then
  echo "ERRO: não vieram faixas do Cloudflare. Nada foi alterado."
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
echo "==> Escrito $OUT ($(grep -c '^set_real_ip_from' "$OUT") faixas)"

# Este nginx serve os outros projetos: testar ANTES de recarregar não é zelo,
# é o que impede derrubar todos os sites com um arquivo inválido.
nginx -t
nginx -s reload
echo "==> nginx recarregado"
