# Warehouse Layout Planner — server

Backend for the layout planner. Stores each person's saved sites so they're
available from any browser/device, not just the one that created them.

## Run it

```
node server.js
```

No `npm install` needed — it only uses Node's built-in modules. Then open:

```
http://localhost:8934
```

Change the port with `PORT=3000 node server.js`.

To enable the optional **AI Refine** button in the app, set an Anthropic API
key before starting the server:

```
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Without it, AI Refine stays hidden — everything else works exactly the same.

To enable **Import a photo** on the Step 2 canvas (upload a sketch/photo of a
floor plan and have it read onto the grid automatically), set a Gemini API
key:

```
GEMINI_API_KEY=... node server.js
```

Optionally override the model with `GEMINI_MODEL=...` (defaults to
`gemini-2.5-flash`). Without a key, the photo-import button stays hidden.

## What it does

- Serves the frontend (`../darkstore-layout-planner.html`) at `/`.
- `POST /api/login` — takes `{ email }`, no password/OTP yet, returns a
  signed token used for every other request.
- `GET/POST /api/sites`, `GET/DELETE /api/sites/:id` — save, list, fetch,
  and delete a signed-in person's own sites. The server checks ownership
  on every request — one person can never see or touch another's sites,
  even by guessing an id.
- `GET /api/ai-status` — `{available: boolean}`, tells the frontend whether
  `ANTHROPIC_API_KEY` is set, so it can show/hide the AI Refine button.
- `POST /api/ai-refine` — takes `{summary}` (a text description of one
  site's layout), calls the Anthropic API server-side (key never touches
  the browser), and returns a short list of suggested improvements. 501 if
  no key is configured. Uses Node's built-in `https` module, not the
  Anthropic SDK, to keep this server at zero npm dependencies.
- `GET /api/vision-status` — `{available: boolean}` for `GEMINI_API_KEY`.
- `POST /api/vision-import` — takes `{image, mimeType}` (a base64-encoded
  photo of a floor plan), calls the Gemini API server-side, and returns
  `{walls, entries, exits}` as fractional (0–1) image coordinates for the
  frontend to map onto the canvas grid. 501 if no key is configured.

## Data

Everything lives in `data/`, created on first run:

- `users.json` — email → when they first signed in.
- `sites.json` — every saved site, keyed by id.
- `secret.key` — random key used to sign login tokens. Generated once;
  keep it if you want existing logins to stay valid across restarts —
  deleting it just signs everyone out, no data is lost.

It's plain JSON on disk, not a "real" database — deliberately, so there's
nothing to install or configure. Back it up by copying the `data/` folder.
If this ever needs to handle real concurrent load, swap `loadJson`/`saveJson`
in `server.js` for a proper database — every read/write already goes
through those two functions.

## Deploying somewhere real

Right now this is meant to run on one machine (a laptop, an internal
server) that people on the same network can reach. To make it reachable
outside `localhost`, run it on a server with a stable address and point
people at `http://that-address:8934` — no code changes needed, just where
you run `node server.js`.
