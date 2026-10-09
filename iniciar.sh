#!/usr/bin/env bash
# Sobe o EscolaAlerta completo: banco (Docker) + API (:3333) + front (:5500).
# Uso: ./iniciar.sh   (Ctrl+C encerra API e front; o banco continua no Docker)
set -e
RAIZ="$(cd "$(dirname "$0")" && pwd)"
cd "$RAIZ/api"

# .env local com um segredo aleatório, criado só na primeira vez (fica fora do git).
if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL=postgres://escolaalerta:escolaalerta@localhost:5432/escolaalerta
DATABASE_URL_TEST=postgres://escolaalerta:escolaalerta@localhost:5433/escolaalerta_test
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
FRONT_URL=http://localhost:5500
PORT=3333
EOF
  echo "Criado api/.env"
fi

[ -d node_modules ] || npm install

docker compose up -d db
echo -n "Aguardando o banco"
until docker exec escolaalerta-db pg_isready -U escolaalerta >/dev/null 2>&1; do echo -n "."; sleep 1; done
echo

npm run db:migrate
npm run db:seed

trap 'kill 0' EXIT
npm run dev &
(cd "$RAIZ/front" && python3 -m http.server 5500 --bind 127.0.0.1 >/dev/null 2>&1) &

sleep 3
echo
echo "EscolaAlerta no ar: http://localhost:5500/  (Ctrl+C para encerrar)"
xdg-open http://localhost:5500/ >/dev/null 2>&1 || true
wait
