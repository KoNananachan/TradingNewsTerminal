# Deployment Workflow

Every update follows the same 3-step cycle: **Code → GitHub → Cloud Run**.

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) — authenticated
- [Google Cloud SDK](https://cloud.google.com/sdk) (`gcloud`) — authenticated, project set to `tradingnewsterminal`

## Step 1: Make Changes Locally

```bash
# Start dev servers (backend :3001 + frontend :5174)
npm run dev

# Verify build passes
npm run build
```

## Step 2: Push to GitHub

```bash
# Stage & commit
git add -A
git commit -m "Description of changes"

# Push
git push origin main
```

**Don't forget:** Update `CHANGELOG.md` with a summary of what changed before committing.

## Step 3: Deploy to Cloud Run

```bash
# Build container image (takes ~6 min first time, ~2-3 min after)
gcloud builds submit --tag gcr.io/tradingnewsterminal/tradingnewsweb

# Deploy new revision
gcloud run deploy tradingnewsweb \
  --image gcr.io/tradingnewsterminal/tradingnewsweb \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 8080 \
  --set-env-vars "DATABASE_URL=file:./prisma/prod.db,GEMINI_BASE_URL=https://api.apiplus.org/v1,GEMINI_MODEL=gemini-2.0-flash,SCRAPE_INTERVAL_MINUTES=1,GEMINI_API_KEY=<your-key>" \
  --memory 512Mi --cpu 1 \
  --min-instances 1 --max-instances 3 \
  --timeout 3600 --session-affinity
```

## Quick Reference

| Action | Command |
|--------|---------|
| Local dev | `npm run dev` |
| Build check | `npm run build` |
| Push to GitHub | `git push origin main` |
| Build image | `gcloud builds submit --tag gcr.io/tradingnewsterminal/tradingnewsweb` |
| Deploy | `gcloud run deploy tradingnewsweb --image gcr.io/tradingnewsterminal/tradingnewsweb ...` |
| View logs | `gcloud run services logs read tradingnewsweb --region us-central1` |
| Live URL | https://tradingnewsweb-985277157092.us-central1.run.app |

## Notes

- First build is slow (~6 min) because Docker pulls base images. Subsequent builds cache layers and take ~2-3 min.
- SQLite is ephemeral on Cloud Run — data resets when the instance restarts. The server auto-seeds categories and default stocks on startup.
- `min-instances 1` ensures the scraper keeps running. Setting it to 0 saves cost but loses data and scraping continuity.
- Environment variables with secrets (like `GEMINI_API_KEY`) should ideally be stored in Google Secret Manager for production use.
