# ProMove

ProMove Innovation Cloud monorepo.

- `Client/` contains the React + Vite application.
- `Server/` contains the Express + TypeScript API.
- `docker-compose.yml` boots both apps for local development.
- Root `Dockerfile` builds both the API and the React app for single-service Docker platforms such as Render.
- When deployed from the root image, the frontend is served by Express and talks to the API on the same origin by default.
