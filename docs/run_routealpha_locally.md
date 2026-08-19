# Run RouteAlpha Locally

This guide starts the complete RouteAlpha product on macOS:

- FastAPI backend at `http://127.0.0.1:8000`
- Next.js frontend at `http://localhost:3000`
- Local SQLite database for the quickest setup

## 1. Prerequisites

From any Terminal directory, install Node.js and confirm the required tools exist:

```bash
brew install node
node --version
npm --version
/opt/homebrew/bin/python3.12 --version
```

Node includes `npm`. The directory where you run `brew install node` does not matter because Homebrew installs it system-wide.

If `node` or `npm` is still not found after installation, open a new terminal or run:

```bash
export PATH="/opt/homebrew/bin:$PATH"
```

## 2. Configure the backend

Open `backend/.env`. For the fastest local setup, use SQLite instead of requiring a local PostgreSQL server:

```env
DATABASE_URL=sqlite:///./routealpha.sqlite3
```

Keep these existing values configured:

```env
OPENROUTER_API_KEY=your_openrouter_key
AUTH_SECRET_KEY=a-long-random-secret
```

`OPENROUTER_API_KEY` is required to run real model inference. The API can start without local ONNX model files; in that case it safely uses static routing instead of semantic classification.

## 3. Start the backend

In the first terminal:

```bash
cd ~/Documents/GitHub/route-alpha/backend
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Do not use `pip` or `uvicorn` directly from the virtual environment if they report a stale interpreter path. Running them with `./.venv/bin/python -m ...` always uses the correct environment.

Successful startup includes a line similar to:

```text
Uvicorn running on http://127.0.0.1:8000
```

Verify the backend in a browser:

- Health check: <http://127.0.0.1:8000/health>
- Interactive API docs: <http://127.0.0.1:8000/docs>

The first run creates `backend/routealpha.sqlite3` automatically.

## 4. Start the frontend

Open a second terminal. Leave the backend running in the first one.

```bash
cd ~/Documents/GitHub/route-alpha/frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

The frontend reads `frontend/.env.local`. It must point at the local backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 5. Basic product walkthrough

1. Open <http://localhost:3000> and view the landing page.
2. Go to `/auth` and create an account.
3. Go to `/infer`, submit a prompt, choose a priority, and inspect the route, model, latency, cost, and fallback metadata.
4. Go to `/dashboard` to view logged inference analytics.
5. Use `/contact` to test the contact/demo request flow.

## 6. Optional: use PostgreSQL instead of SQLite

For a closer production-like local setup:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb routealpha_db
```

Then set this in `backend/.env` using your macOS username:

```env
DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/routealpha_db
```

Restart the backend after changing the database URL.

## 7. Troubleshooting

### `npm: command not found`

Install Node.js, then open a new terminal:

```bash
brew install node
node --version
npm --version
```

### `connection to server at localhost port 5432 failed`

PostgreSQL is not running. Either start PostgreSQL with `brew services start postgresql@16`, or change `DATABASE_URL` to the SQLite URL in step 2.

### The backend starts but semantic classification is unavailable

This is safe. RouteAlpha uses static routing. To enable local semantic classification, place these files in `backend/models/all-MiniLM-L6-v2-onnx/`:

```text
model.onnx
tokenizer.json
```

Then configure:

```env
EMBEDDING_MODEL_DIR=./models/all-MiniLM-L6-v2-onnx
```

### Inference requests fail

Confirm `OPENROUTER_API_KEY` is present in `backend/.env`, restart the backend, and inspect the backend terminal output for the upstream model error.

### The frontend cannot reach the backend

Confirm both processes are running and verify:

```bash
curl http://127.0.0.1:8000/health
```

Also verify `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env.local`. Restart `npm run dev` after editing frontend environment variables.

## 8. Stop the app

Press `Control-C` in each terminal running the backend or frontend server.
