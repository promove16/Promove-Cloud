# ProMove

ProMove Innovation Cloud monorepo.

- `Client/` contains the React + Vite application.
- `Server/` contains the Express + TypeScript API.
- `docker-compose.yml` boots both apps for local development.
- Root `Dockerfile` packages the API for single-service Docker platforms such as Render.
- Deploy the frontend separately, or point it at the deployed API with `VITE_API_BASE_URL`.
