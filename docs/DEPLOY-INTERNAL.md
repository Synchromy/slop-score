# Slop Score — internal (Tailscale) deployment

This is the **internal, tailnet-only** deploy used for dogfooding before a public
launch. It is deliberately not reachable from the public internet. Public launch
is a separate Cloudflare deploy (see "Next: public launch" below).

## Live URL (tailnet only)

    https://synchromy-openclaw-vps.tailfd4a7f.ts.net:8444

Reachable by any device on the Synchromy tailnet (Neel, Khoa, Davina). Automatic
HTTPS via Tailscale. Not exposed on any public interface.

## What is running

One Docker container serves **both** the static web app and the JSON API from a
single origin (so lead capture is same-origin, no CORS needed):

- Image: `slop-score:latest` (built from `Dockerfile`, `node:22-slim`)
- Container: `slop-score`, `--restart unless-stopped` (survives VPS reboot)
- Binds `127.0.0.1:8790` only; Tailscale `serve` proxies `:8444` -> `127.0.0.1:8790`
- Routes: `GET /health`, `POST /score`, `POST /leads`, and static web for everything else
- Leads persist to SQLite (`node:sqlite`) at `/data/leads.db` inside the container,
  mounted from the host at:

      /home/synchromyops/agents/taka/work/slop-score-data/leads.db

## View captured leads

    docker exec slop-score node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/leads.db');console.table(db.prepare('select * from leads order by rowid').all())"

## Ops

    docker logs -f slop-score          # logs
    docker restart slop-score          # restart (leads persist on the host volume)
    docker ps --filter name=slop-score # status

Rebuild + redeploy after code changes:

    cd /home/synchromyops/agents/taka/work/slop-score
    docker build -t slop-score:latest .
    docker rm -f slop-score
    docker run -d --name slop-score --restart unless-stopped \
      -p 127.0.0.1:8790:8790 \
      -v /home/synchromyops/agents/taka/work/slop-score-data:/data \
      slop-score:latest

## Teardown (fully reversible)

    tailscale serve --https=8444 off     # remove the tailnet endpoint
    docker rm -f slop-score              # stop + remove the container
    # leads DB is preserved at the host path above; delete it only if you mean to

Nothing here touches nginx or the other services on this box (synchromy_web,
mastra, postiz). The only shared surface used is Tailscale `serve`, and the
`:8444` entry is additive to the existing `/` and `:8443` entries.

## Next: public launch (Cloudflare, when you decide)

The lead store sits behind a `LeadStore` interface (`services/api/src/lead-store.ts`),
so the public build swaps `SqliteLeadStore` for a Cloudflare D1-backed implementation
without touching the API routes or the web app. Static web -> Cloudflare Pages,
API -> Workers. This keeps the public, stranger-facing tool off this internal box.
