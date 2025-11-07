#!/bin/bash

APP_LEVEL=$APP_LEVEL
export PATH="/root/.nvm/versions/node/v22.14.0/bin:$PATH"

# Run alembic revisions
cd /project
pdm run alembic upgrade head

if [ "$APP_LEVEL" == "PROD" ]; then
    export FRONTEND_COMMAND="npm run start"
    export BACKEND_COMMAND="pdm run python -m uvicorn src.saas_backend.app:app --host 0.0.0.0 --port 8000"
else
    export FRONTEND_COMMAND="npm run dev"
    export BACKEND_COMMAND="pdm run python -m uvicorn src.saas_backend.app:app --reload --host 0.0.0.0 --port 8000"
fi

echo $APP_LEVEL

# Emit runtime client config so frontend can read env vars at runtime even when the image
# was built separately (useful when image is pulled from a registry and envs only set in compose).
RUNTIME_CONFIG_PATH="/app/public/runtime-config.js"
mkdir -p "$(dirname "$RUNTIME_CONFIG_PATH")"
cat > "$RUNTIME_CONFIG_PATH" <<- RUNTIME
// This file is generated at container start and exposes selected env vars to the browser.
// Values are expanded here; if you change env var names update frontend runtime util accordingly.
window.__RUNTIME_CONFIG__ = {
    HEADER_AUTH_ENABLED: "${HEADER_AUTH_ENABLED:-false}",
    HEADER_AUTH_LOGOUT_URL: "${HEADER_AUTH_LOGOUT_URL:-}",
    HEADER_AUTH_USERNAME_HEADER: "${HEADER_AUTH_USERNAME_HEADER:-X-Authentik-Username}",
    HEADER_AUTH_EMAIL_HEADER: "${HEADER_AUTH_EMAIL_HEADER:-X-Authentik-Email}",
    API_URL: "${API_URL:-http://127.0.0.1:8000}"
};
RUNTIME

/usr/bin/supervisord -c /supervisor.conf
