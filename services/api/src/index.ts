import { createApiServer } from "./server.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const server = createApiServer({
  ...(process.env.SLOP_SCORE_API_TOKEN ? { apiToken: process.env.SLOP_SCORE_API_TOKEN } : {}),
  rateLimit: {
    maxRequests: Number(process.env.SLOP_SCORE_RATE_LIMIT_MAX ?? 60),
    windowMs: Number(process.env.SLOP_SCORE_RATE_LIMIT_WINDOW_MS ?? 60_000),
  },
});

server.listen(port, host, () => {
  console.log(`Slop Score API listening on http://${host}:${port}`);
});
