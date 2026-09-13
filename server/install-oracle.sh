#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "Execute como usuário ubuntu, não como root."
  exit 1
fi

read -rsp "Cole o Access Token de produção do Mercado Pago: " MP_TOKEN
echo
if [[ $MP_TOKEN != APP_USR-* ]]; then
  echo "Use o Access Token de produção, iniciado por APP_USR-."
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATUS_SECRET="$(openssl rand -hex 32)"

sudo apt-get update
sudo apt-get install -y python3-venv certbot python3-certbot-nginx
sudo install -d -o www-data -g www-data -m 0750 /opt/faz-pix
sudo install -d -o www-data -g www-data -m 0750 /var/lib/faz-pix
sudo install -o www-data -g www-data -m 0640 "$SCRIPT_DIR/faz_pix_api.py" /opt/faz-pix/faz_pix_api.py
sudo install -o www-data -g www-data -m 0640 "$SCRIPT_DIR/requirements.txt" /opt/faz-pix/requirements.txt
sudo install -d -o root -g root -m 0755 /var/www/faz-apoie
sudo install -o root -g root -m 0644 "$SCRIPT_DIR/apoie.html" /var/www/faz-apoie/index.html
sudo python3 -m venv /opt/faz-pix/venv
sudo /opt/faz-pix/venv/bin/pip install -r /opt/faz-pix/requirements.txt

sudo tee /etc/faz-pix.env >/dev/null <<EOF
MP_ACCESS_TOKEN=$MP_TOKEN
STATUS_SECRET=$STATUS_SECRET
MP_NOTIFICATION_URL=https://faz.whats.men/webhook/mercadopago
EOF
sudo chmod 600 /etc/faz-pix.env

sudo install -m 0644 "$SCRIPT_DIR/faz-pix.service" /etc/systemd/system/faz-pix.service
sudo install -m 0644 "$SCRIPT_DIR/nginx-faz.conf" /etc/nginx/sites-available/faz.whats.men
sudo ln -sfn /etc/nginx/sites-available/faz.whats.men /etc/nginx/sites-enabled/faz.whats.men
sudo systemctl daemon-reload
sudo systemctl enable --now faz-pix
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d faz.whats.men --redirect --non-interactive --agree-tos --register-unsafely-without-email

curl --fail --silent --show-error https://faz.whats.men/health
echo
echo "API Pix de produção instalada com sucesso."
