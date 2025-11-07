# Anirra

Anirra is a completely self-hosted anime watchlist, search, and recommendations app. It allows anime enthusiasts to manage their watchlists, discover new anime, and receive personalized recommendations, all from a single platform.

## Features

- **Watchlist Management**: Keep track of the anime you plan to watch, are currently watching, or have completed.
- **Search Functionality**: Easily search for anime by title or tags.
- **Personalized Recommendations**: Get suggestions based on your watchlist and preferences.
- **Integration with Sonarr and Radarr**: Seamlessly add series and movies to your media server.
- **Convert your MAL list**: Upload your MAL XML file from [MAL XML Exporter](https://myanimelist.net/panel.php?go=export), and easily move to using Anirra.
- **Rate your Anime**: Easily rate your anime when you're done watching.
- **Export your watchlist**: Easily export your watchlist if you were to ever choose to leave Anirra.

## Screenshots

To give you a better idea of what Anirra looks like, here are some screenshots of the app in action:

### Main Page (Logged In)
![Main Page](docs/images/main-page-logged-in.png)

### Anime Page
![Anime Page](docs/images/anime-page.png)

### Search Page
![Search Page](docs/images/search-page.png)

### Watchlist Page
![Watchlist Page](docs/images/watchlist-page.png)

### Sonarr Integration
![Sonarr](docs/images/sonarr.png)

### Radarr Integration
![Radarr](docs/images/radarr.png)

## Launching the App

To launch the app, use the `docker-compose.yml` file located in the root directory of the project. Ensure you have `make` and `docker` installed, then run the following command in your terminal:

```bash
make pull up
```

### Default User Credentials

The default user credentials are:

```
user: admin
password: admin
```

But if you would like to, you can create a new user with a more secure password.

## Configuration

There are a few set of environment variables you can use to customize the app (all are completely optional). 

```
APP_LEVEL=(DEV || PROD) # defaults to PROD in the docker-compose.yml
DATABASE_URL=whatever you want here if you don't want to use the sqlite database that the app comes with
JSON_DATA_PATH=wherever the `anime_offline_database.json` is located, by default its at /data
JWT_SECRET=a secret used to encode the user jwt
API_URL=if you somehow got the api to run anywhere else
NEXTAUTH_SECRET=a secret used to encode the next jwt
# Header-based authentication (proxy auth like Authentik)
HEADER_AUTH_ENABLED=true|false (default false)
HEADER_AUTH_USERNAME_HEADER=Header carrying username (default: X-Authentik-Username)
HEADER_AUTH_EMAIL_HEADER=Header carrying email (default: X-Authentik-Email)
HEADER_AUTH_LOGOUT_URL=External end-session URL (e.g., https://authentik.url.tld/application/o/<app>/end-session/)

# Frontend uses same env vars exposed via Next.js (no NEXT_PUBLIC duplicates needed)
```

### Sonarr and Radarr configuration

Setup the `config.yaml` at the root of the project:

```yaml
sonarr:
  url: http://<ip_or_address>:<port>
  api_key: 123456

radarr:
  url: http://<ip_or_address>:<port>
  api_key: 123456
```

## Example Docker Compose

```yaml
services:
  anirra:
    container_name: anirra
    image: jpyles0524/anirra:latest
    build:
      context: .
      dockerfile: Dockerfile
    command: bash /start.sh
    environment:
      - APP_LEVEL=PROD
      - NEXTAUTH_URL=<your_deployment_url>
      # --- Header-based Auth (Authentik) ---
      - HEADER_AUTH_ENABLED=true
      - HEADER_AUTH_USERNAME_HEADER=X-Authentik-Username
      - HEADER_AUTH_EMAIL_HEADER=X-Authentik-Email
      - HEADER_AUTH_LOGOUT_URL=https://authentik.url.tld/application/o/anirra/end-session/
  # No separate NEXT_PUBLIC_* flags required – Next.js exposes them via next.config.ts
    volumes:
      - ./data:/project/data
      - ./config.yaml:/project/config.yaml
    ports:
      - 3000:3000
      - 8000:8000
```

## Using header-based authentication (Authentik / reverse proxy)

Anirra can work behind an authentication proxy similar to Firefly-III. When enabled:

- Local username/password login is disabled.
- User self-registration is disabled.
- Unknown users coming from proxy headers are auto-created on first login (with an empty local password) along with an initial watchlist.
- The Logout button redirects to your identity provider's end-session URL.

### How it works

1. Your reverse proxy (e.g., Authentik) authenticates the user and injects headers (username/email) into requests to Anirra.
2. The frontend triggers a backend endpoint `/header-login`, which reads these headers, provisions the user if needed, and issues an Anirra JWT.
3. All other API requests use that JWT as before.

### Required proxy headers

Configure your proxy to send at least a username header to the app. Defaults assume Authentik:

- `X-Authentik-Username`
- `X-Authentik-Email` (optional but recommended)

You can change the names via `HEADER_AUTH_USERNAME_HEADER` and `HEADER_AUTH_EMAIL_HEADER`.

### Logout

Set `HEADER_AUTH_LOGOUT_URL` to your provider's end-session endpoint. For Authentik it looks like:

```
https://authentik.url.tld/application/o/<application-slug>/end-session/
```

The frontend reads `HEADER_AUTH_ENABLED` and `HEADER_AUTH_LOGOUT_URL` directly (injected by Next.js build). No `NEXT_PUBLIC_` prefix is required in this unified container setup.

### Notes

- When header-auth is enabled, the `/login` and `/register` endpoints are disabled and will return 403.
- The new endpoint `/header-login` is used by the UI and should be accessible only behind your auth proxy.

## Coming Soon

- **Mobile Support**: Simplified UI for mobile viewing
- **Watchlist Rating**: Rate the anime and get better recommendations based off of what you like
- **Jellyfin Integration**: Automatically sync the anime you are watching on Jellyfin

