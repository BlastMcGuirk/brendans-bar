# Brendan's Bar

## Deploying to Render

The root `render.yaml` configures one Render web service for both the Express API and the built frontend. The app uses the same origin for its pages and `/api` requests, so no production API URL or separate frontend service is needed.

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository. Render reads `render.yaml` and asks for `DATABASE_URL`.
3. Paste the PostgreSQL connection string for the existing Neon database into Render's secret prompt. For this long-running Node service, use Neon’s direct (non-pooled) connection string so Prisma migrations can run. Keep it in Render's environment settings; do not commit it to the repository.
4. Deploy the Blueprint. Render installs dependencies, builds the workspaces, applies pending Prisma migrations, then starts the app. The service's health check is `/health`.
5. Open the service URL Render provides. The ordering and admin pages and the API are served from that URL.

Render watches the branch you select when connecting the Blueprint and automatically builds and deploys commits pushed to that branch. To change the deploy branch or automatic deploy behavior, use the service's **Settings** in Render.

The free web-service plan is suitable for trying out or hobby use, not production: Render spins an idle service down after 15 minutes, and the next request can take about a minute to wake it. Its filesystem is ephemeral, so persistent data belongs in Neon, not on the Render service. Review Render's current [free instance limitations](https://render.com/docs/free) before relying on the free plan.

Prisma migrations in `apps/backend/prisma/migrations` are applied during startup. Commit new migrations with the code changes that require them.
