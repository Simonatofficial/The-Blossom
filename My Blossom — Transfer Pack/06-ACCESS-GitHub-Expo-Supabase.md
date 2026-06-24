# Access & Credentials — GitHub · Expo.dev · Supabase

*Everything to reach and edit your infrastructure, in one place. These are shared across your apps — the same repo, Expo project, and Supabase project carry over to The Blossom / My Blossom.*

> **Security, read once:**
> - The **anon / publishable** Supabase key below is **public by design** — it ships in the app and is safe to share. Row Level Security (RLS) is what protects your data.
> - The **service-role / secret** key is the dangerous one. It is **NOT in this file**, must **never** be committed or pasted into the app, and lives only in the Supabase dashboard / server env. Don't put it here.
> - Your `.env` file (which holds these) is **gitignored** — keep it that way.

---

## 🔗 Quick links
- **GitHub repo:** https://github.com/Simonatofficial/My-Blossom
- **Supabase dashboard:** https://supabase.com/dashboard/project/ayxeoaxnvypjiqrlumiz
- **Expo dashboard:** https://expo.dev/accounts/my-blossom/projects/my-blossom

---

## 1. GitHub

| Field | Value |
|---|---|
| Repo URL | `https://github.com/Simonatofficial/My-Blossom.git` |
| Owner | `Simonatofficial` |
| Default branch | `main` |
| Web | https://github.com/Simonatofficial/My-Blossom |

**Accessing / editing**
- **In the browser:** open the repo URL, edit any file with the pencil icon, commit.
- **Clone to a computer:**
  ```bash
  git clone https://github.com/Simonatofficial/My-Blossom.git
  cd My-Blossom
  ```
- **Connect an existing local folder that has no remote yet:**
  ```bash
  git remote add origin https://github.com/Simonatofficial/My-Blossom.git
  git add -A && git commit -m "message"
  git push -u origin main          # add --force only if intentionally replacing history
  ```
- **Everyday commands:** `git pull` (get latest) · `git add -A && git commit -m "…"` · `git push` (send up).

**Pushing needs auth** (one-time). Easiest options:
- **GitHub CLI:** install `gh`, run `gh auth login` → follow the browser prompt. Done.
- **Personal Access Token (PAT):** GitHub → Settings → Developer settings → Personal access tokens → generate one with `repo` scope; use it as the password when git asks.
- **SSH:** add an SSH key (GitHub → Settings → SSH keys) and use the `git@github.com:Simonatofficial/My-Blossom.git` URL.

---

## 2. Expo.dev (the "dev" build service / EAS)

> **When you need this:** only if you build the app through **Expo / EAS** (the React-Native path). For The Blossom as a **web app wrapped with Capacitor/TWA**, you don't need Expo — the equivalents are Capacitor + Live Updates. Kept here because the project exists and you may use EAS for builds/OTA.

| Field | Value |
|---|---|
| Expo account / owner | `my-blossom` *(verify on expo.dev; was `cozycosmo` earlier)* |
| Project slug | `my-blossom` |
| EAS project ID | `b300747b-22e7-421c-8dd8-ca73bb14765e` *(last known — confirm in the dashboard / `app.json` → `expo.extra.eas.projectId`)* |
| Android package | `com.simon.myblossom` |
| iOS bundle ID | `com.simon.myblossom` |
| Dashboard | https://expo.dev/accounts/my-blossom/projects/my-blossom |

**Accessing / using**
- **Dashboard:** log in at https://expo.dev with the account that owns the project; you'll see builds, updates, secrets.
- **CLI:**
  ```bash
  npm i -g eas-cli
  eas login                       # sign in
  eas build:configure
  eas build -p android            # cloud-build an APK/AAB
  eas update                      # push an OTA JS update (no reinstall)
  ```
- **Secrets for cloud builds:** set `SUPABASE_URL` + `SUPABASE_ANON_KEY` as **EAS secrets** (dashboard → project → Secrets, or `eas secret:create`) so builds get them without committing `.env`.

---

## 3. Supabase (accounts + sync)

| Field | Value |
|---|---|
| Project ref | `ayxeoaxnvypjiqrlumiz` |
| Project URL | `https://ayxeoaxnvypjiqrlumiz.supabase.co` |
| Anon / publishable key (PUBLIC — safe) | `sb_publishable_ipzvW4GvSP1pnqW0pfLwIw_j89XAGgx` |
| Service-role / secret key | **NOT stored here** — dashboard → Settings → API → "service_role" (keep secret) |
| Dashboard | https://supabase.com/dashboard/project/ayxeoaxnvypjiqrlumiz |

**Where these live in the app**
- `.env` (gitignored):
  ```
  SUPABASE_URL=https://ayxeoaxnvypjiqrlumiz.supabase.co
  SUPABASE_ANON_KEY=sb_publishable_ipzvW4GvSP1pnqW0pfLwIw_j89XAGgx
  ```
- The web app reads them directly when creating the Supabase client; an RN/Expo app reads them via `app.config.js → expo.extra`.

**Accessing / editing**
- **Dashboard:** open the project URL above → **Table Editor** (data), **SQL Editor** (run the schema), **Authentication** (providers/users), **Settings → API** (keys + project URL), **Logs** (debug).
- **Get/rotate keys:** Settings → API. The **anon/publishable** key is public; the **service_role** key is secret.
- **Run the schema:** SQL Editor → paste `TRANSFER.md` §6.1 (the `objects` table + RLS) → Run.
- **Enable sign-in:** Authentication → Providers → turn on **Anonymous**, **Email**, (optionally **Google**). Set **Authentication → URL Configuration → Site URL** to your real site so confirmation emails don't point at `localhost`.

**Non-negotiable security (from your Design Doc)**
- **RLS ON, always** (`auth.uid() = user_id`) — a user only ever sees their own rows.
- **Only the anon/publishable key** reaches the client; the **service_role** key stays server-side.
- IDs are `text`; deletes are soft (`deleted_at`); private data is never world-readable.

---

## 4. The whole chain (how it fits)
**GitHub** holds the code → you build it (web deploy, or **Expo/EAS**, or **Capacitor** for the wrapped Android app) → the app signs users in and syncs to **Supabase** (offline-first, RLS-protected) → subscriptions run through **RevenueCat** (see `TRANSFER.md` §8). Each piece is independent; you can reach and edit each from its dashboard above.

> If any value here looks stale (owner/project ID especially), the dashboards are the source of truth — open the link and copy the current value.
