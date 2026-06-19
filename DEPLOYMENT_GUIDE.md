# RailBook — GitHub + Vercel + Railway Deployment Guide

Your project has two parts that deploy separately:

| Part | Folder | Where it deploys |
|------|--------|-----------------|
| Backend (FastAPI) | `Ticket_System/` (root Python files) | Railway (free tier) |
| Frontend (Next.js) | `Ticket_System/trainapp/` | Vercel (free tier) |

---

## PART 1 — Prepare your project for GitHub

### Step 1.1 — Place all the deployment files

Copy these files into your project exactly as shown:

```
Ticket_System/               ← your backend root
├── .gitignore               ← COPY from deploy-files/.gitignore
├── .env.example             ← COPY from deploy-files/.env.example
├── Procfile                 ← COPY from deploy-files/Procfile
├── runtime.txt              ← COPY from deploy-files/runtime.txt
├── .env                     ← already exists, DO NOT touch (it's ignored)
├── requirements.txt         ← already exists, DO NOT touch
├── main.py                  ← already exists
└── trainapp/
    ├── .env.example         ← COPY from deploy-files/trainapp.env.example (rename to .env.example)
    ├── .env.local           ← already exists, DO NOT touch (it's ignored)
    ├── .gitignore           ← already exists (leave it)
    └── vercel.json          ← COPY from deploy-files/vercel.json (replaces existing)
```

### Step 1.2 — Fix requirements.txt (remove duplicate and inline comments)

Open `Ticket_System/requirements.txt` and make it look exactly like this
(remove the comments and the duplicate `python-multipart` line):

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.2
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
bcrypt==4.0.1
python-multipart==0.0.6
alembic==1.12.1
python-dotenv==1.0.0
redis==5.0.1
celery==5.3.4
kombu==5.3.2
elasticsearch==8.11.0
aio-pika==9.3.1
flower==2.0.1
Jinja2==3.1.2
```

### Step 1.3 — Fix alembic.ini (remove the hardcoded local DB URL)

Open `Ticket_System/alembic.ini` and change line 4 from:
```
sqlalchemy.url = postgresql://postgres:postgres123@127.0.0.1:5432/train_booking
```
to:
```
sqlalchemy.url = postgresql://placeholder
```
The real URL is always injected from the DATABASE_URL environment variable via
`alembic/env.py` — the placeholder is just so alembic doesn't error on import.

### Step 1.4 — Verify your alembic/env.py reads DATABASE_URL

Open `Ticket_System/alembic/env.py` and make sure it has this block near the top:

```python
import os
database_url = os.getenv('DATABASE_URL')
if database_url:
    config.set_main_option('sqlalchemy.url', database_url)
```

If it doesn't, add those 3 lines right after `config = context.config`.

---

## PART 2 — Push to GitHub

### Step 2.1 — Install Git (if not already)

```bash
# Check if git is installed
git --version

# If not installed, on Windows download from: https://git-scm.com/download/win
# On Ubuntu/WSL2:
sudo apt install git -y
```

### Step 2.2 — Configure Git with your identity (one-time setup)

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 2.3 — Create a GitHub repository

1. Go to https://github.com → click the **+** icon (top right) → **New repository**
2. Repository name: `railbook`  (or any name you like)
3. Description: `Train ticket booking platform`
4. Visibility: **Public** (required for free Vercel deployment)
   - Private also works if you connect your GitHub account to Vercel
5. **Do NOT** tick "Add a README" or "Add .gitignore" — you already have them
6. Click **Create repository**
7. GitHub shows a page with your repo URL — copy it, e.g.:
   `https://github.com/yourusername/railbook.git`

### Step 2.4 — Initialise git and push

Open a terminal **inside your `Ticket_System` folder** (the one with `main.py`):

```bash
# Go to your project root
cd /mnt/d/Ticket_System

# Initialise git
git init

# Add the remote (paste YOUR repo URL from Step 2.3)
git remote add origin https://github.com/yourusername/railbook.git

# Stage everything (the .gitignore will automatically exclude venv/, .env, node_modules/, .next/)
git add .

# Check what will be committed — make sure .env and venv/ are NOT listed
git status

# If .env or venv/ appear in the list, something is wrong with .gitignore — stop and fix it first

# Commit
git commit -m "Initial commit — RailBook Level 3"

# Push to GitHub
git branch -M main
git push -u origin main
```

After pushing, refresh your GitHub repo page — you should see all your files
but NOT `.env`, `venv/`, `node_modules/`, or `.next/`.

---

## PART 3 — Deploy the Backend on Railway

Railway gives you a free PostgreSQL database + free app hosting (500 hours/month).

### Step 3.1 — Create a Railway account

Go to https://railway.app → **Login with GitHub** → authorise Railway.

### Step 3.2 — Create a new project

1. Click **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `railbook` repository
4. Railway detects Python and shows a deployment — click **Deploy Now**
5. It will fail the first time because there's no DATABASE_URL yet — that's fine.

### Step 3.3 — Add a PostgreSQL database

1. Inside your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway creates a Postgres instance and automatically sets `DATABASE_URL`
   as an environment variable in your project. You don't need to copy it manually.

### Step 3.4 — Add a Redis instance

1. Click **+ New** → **Database** → **Add Redis**
2. Railway automatically sets `REDIS_URL`. Copy the value — you'll need it for
   the `CELERY_RESULT_BACKEND` variable too.

### Step 3.5 — Set environment variables on Railway

Click your **app service** (not the database) → **Variables** tab → click **Raw Editor**
and paste all of these, replacing placeholder values:

```
SECRET_KEY=paste_a_long_random_secret_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CACHE_TTL_SECONDS=300
RABBITMQ_URL=amqp://guest:guest@localhost/
ELASTICSEARCH_URL=http://localhost:9200
ES_TRAINS_INDEX=trains
ES_STATIONS_INDEX=stations
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
EMAIL_FROM=noreply@trainbooking.com
```

> **Note on RABBITMQ_URL and ELASTICSEARCH_URL:**  
> These services aren't free on Railway. For the MVP deployment, your app will
> start with them unavailable — it will log warnings but still work for bookings,
> auth, and train search (falling back to PostgreSQL search). Add them when
> you're ready to scale. See Part 5 for free options.

> **How to generate SECRET_KEY:**
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(32))"
> ```

### Step 3.6 — Set the start command

Click your app service → **Settings** → **Start Command**, set:
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Step 3.7 — Run Alembic migrations on Railway

After the first successful deploy, click **New** → **Job** → one-time command:
```
alembic upgrade head
```
Or use the Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway run alembic upgrade head
```

### Step 3.8 — Get your backend URL

Click your app service → **Settings** → you'll see a domain like:
`https://railbook-production.up.railway.app`

**Save this URL** — you need it for the Vercel frontend setup.

---

## PART 4 — Deploy the Frontend on Vercel

### Step 4.1 — Create a Vercel account

Go to https://vercel.com → **Sign up with GitHub** → authorise Vercel.

### Step 4.2 — Import your repository

1. On the Vercel dashboard click **Add New → Project**
2. Find your `railbook` GitHub repo → click **Import**
3. Vercel auto-detects Next.js ✓

### Step 4.3 — Set the Root Directory

⚠️ This is the most important step. Your Next.js app is inside `trainapp/`,
not at the repo root.

In the **Configure Project** screen:
- Click **Root Directory** → type `trainapp` → click **Continue**

### Step 4.4 — Set environment variables

Still on the same Configure Project screen, scroll to **Environment Variables**:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://railbook-production.up.railway.app` |

(Replace with your actual Railway URL from Step 3.8)

### Step 4.5 — Deploy

Click **Deploy**. Vercel runs `npm install` then `npm run build`. Takes ~1 minute.

You'll get a URL like: `https://railbook.vercel.app` 🎉

### Step 4.6 — Update backend CORS

Now that you know your Vercel URL, open `Ticket_System/main.py` and update
the CORS origins to include your production frontend:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',               # local dev
        'https://railbook.vercel.app',         # your Vercel URL
        'https://railbook-*.vercel.app',       # Vercel preview URLs
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
```

Commit and push this change:
```bash
git add main.py
git commit -m "Add Vercel domain to CORS allowed origins"
git push
```

Railway will auto-redeploy when it sees the new commit.

---

## PART 5 — Optional: Free RabbitMQ + Elasticsearch

For a fully working Level 3 system in production:

### RabbitMQ — CloudAMQP (free tier)
1. Go to https://cloudamqp.com → Create account → **Create new instance**
2. Choose **Little Lemur** plan (free)
3. Copy the **AMQP URL** → set as `RABBITMQ_URL` in Railway
4. Update `CELERY_RESULT_BACKEND` to use your `REDIS_URL` value

### Elasticsearch — Elastic Cloud (free 14-day trial, then $0 if < 8GB)
1. Go to https://cloud.elastic.co → Start free trial
2. Create a deployment → copy the **Cloud ID** and password
3. Update `ELASTICSEARCH_URL` in Railway to:
   `https://username:password@your-cluster.es.io:9243`

---

## PART 6 — Day-to-day workflow after deployment

Every time you make a code change:

```bash
# Make your changes locally
# Test locally first: uvicorn main:app --reload

# Stage and commit
git add .
git commit -m "Your description of what changed"

# Push — this triggers auto-redeploy on both Railway and Vercel
git push
```

Railway and Vercel both watch your `main` branch and redeploy automatically
within ~2 minutes of every push.

### If you add new database columns (new Alembic migration):

```bash
# 1. Create the migration locally
alembic revision --autogenerate -m "describe_your_change"

# 2. Test it locally
alembic upgrade head

# 3. Commit and push
git add alembic/versions/
git commit -m "Add migration: describe_your_change"
git push

# 4. Run the migration on Railway
railway run alembic upgrade head
```

---

## PART 7 — Summary of what goes where

| File/Folder | Committed to Git? | Why |
|-------------|-------------------|-----|
| `.env` | ❌ NO | Contains your real passwords — in .gitignore |
| `.env.example` | ✅ YES | Safe template — shows what vars are needed |
| `.env.local` (frontend) | ❌ NO | Contains API URL override — in .gitignore |
| `venv/` | ❌ NO | 500MB+ of packages — Railway installs from requirements.txt |
| `node_modules/` | ❌ NO | Vercel installs from package.json |
| `.next/` | ❌ NO | Vercel builds this from source |
| `__pycache__/` | ❌ NO | Auto-generated — in .gitignore |
| `requirements.txt` | ✅ YES | Railway reads this to install packages |
| `Procfile` | ✅ YES | Tells Railway how to start the app |
| `runtime.txt` | ✅ YES | Tells Railway which Python version to use |
| `alembic/versions/*.py` | ✅ YES | Migration history must be versioned |
| `alembic.ini` | ✅ YES | Alembic config (without real DB URL) |
| `vercel.json` | ✅ YES | Tells Vercel how to build the frontend |

---

## Quick-reference checklist

- [ ] `.gitignore` placed at `Ticket_System/` root
- [ ] `.env.example` placed at `Ticket_System/` root
- [ ] `Procfile` placed at `Ticket_System/` root
- [ ] `runtime.txt` placed at `Ticket_System/` root
- [ ] `trainapp/vercel.json` updated
- [ ] `requirements.txt` cleaned up (no duplicate lines, no inline comments)
- [ ] `alembic.ini` has placeholder URL, not real password
- [ ] `git status` does NOT show `.env` or `venv/`
- [ ] Railway project created with PostgreSQL + Redis plugins
- [ ] All env vars set on Railway
- [ ] Start command set on Railway
- [ ] `alembic upgrade head` run on Railway after first deploy
- [ ] Vercel project created, Root Directory set to `trainapp`
- [ ] `NEXT_PUBLIC_API_URL` set in Vercel to Railway backend URL
- [ ] Vercel URL added to CORS in `main.py` and pushed
