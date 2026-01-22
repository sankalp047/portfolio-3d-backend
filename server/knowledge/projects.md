
# PROJECTS.md — Radio Sangam / BigFan / CRM (App + Rewards + Admin)

This document is designed so a chatbot (or a new engineer) can answer questions about the full system end-to-end. It captures **what** we built, **why** we chose each technology, and **how** the pieces work together. It also includes deployment steps, cURL tests, IAM fixes, data model, and troubleshooting.

---

## 0) Executive Summary

**Goal:** Build a **modern radio streaming app** with **points-based rewards**, **offer redemption**, and an **admin layer** for partner offers and analytics — plus general CRM tools for sales and production teams.

**Deliverables:**
- **Mobile app (Flutter)** — streaming, discovery UI, points accrual while listening, redeemable offers, Google sign-in, account & history.
- **Firebase backend** — Firestore (data), Auth (Google), Functions Gen2 (business logic), Security Rules, logs.
- **Rewards & Offers** — Admin endpoints to manage partner offers, enforce quotas/hours/days, generate single-use codes, and track redemptions.
- **Admin dashboards** — PHP pages hitting HTTPS Functions (or temporary cURL) for offers and user stats; CRM flows for Radio Sales / Admin Production.
- **Mailgun** — transactional emails (contact/invite/ops), via Node/Express where applicable.

**Outcome:** A production-ready system with clear extension points (more stations, deeper CRM, analytics), strict auth, and recoverable error handling.

---

## 1) System Components (What + Why + How)

### A) Mobile App — **Flutter**
- **Why Flutter?**
  - One codebase for **iOS + Android**.
  - Smooth performance for streaming lists, search, and card-heavy UIs.
  - Strong plugin ecosystem for **audio**, **Firebase**, **Google Auth**, **URL launching**.
- **What it does:**
  - Plays radio streams and shows discovery cards (clients/partners) parsed from a remote JSON feed.
  - Logs **listening events** every minute (while actively playing) to Firestore → Functions accrues points.
  - Displays **offers** and a **Redeem** flow that creates single-use codes & enforces business rules.
  - Shows **Account** → profile, **Points summary**, **Redemption history**, **Active code** (if any).
  - Handles auth states: **guest** vs **Google sign-in**.
- **Key files we worked with:**
  - `podcasts_page.dart` — discovery grid, offer gating, **Redeem** button behavior, code panel, copy-to-clipboard.
  - `user_account.dart` — **Points Summary**, **Redemption list**, sign-out, guest CTA.
  - `radio_service.dart` — playback control; ensures we stop audio on auth transitions.
  - `event_logger.dart` & `engagement_service.dart` — **listening minute pings** (write events) and throttling.
  - `redeem_service.dart` — calls callable function `redeemOffer` and normalizes app errors.
  - `activity_service.dart` — helper for app analytics/events (optional).

> **Clipboard underline fix (Flutter):** import the services APIs:  
> `import 'package:flutter/services.dart' show Clipboard, ClipboardData;`

### B) Firebase — **Auth, Firestore, Functions (Gen2)**
- **Why Firebase?**
  - Handles **auth**, **realtime/transactional data**, and **serverless functions** easily for mobile apps.
  - Native SDKs simplify auth-aware reads/writes, and Firestore security rules restrict access.
- **What it does:**
  - **Auth (Google)**: distinguishes **guest** vs full users.
  - **Firestore**: stores users, events, points, offers, redemptions.
  - **Functions (Gen2)**:
    - `onListeningEvent` — Firestore trigger on `users/{uid}/events/{doc}` to accrue **~0.1666 pts/min**.
    - `redeemOffer` (callable) — enforces all rules and creates redemption codes.
    - `adminOffers` (HTTP) — **list/upsert/delete** offers (for PHP admin page).
    - `adminUserStats` (HTTP) — user **leaderboard** + **user redemptions** for dashboards.
    - `ping` (callable) — simple connectivity check.

> **Gen2 Firestore triggers** require **Eventarc** permissions — see §7.

### C) PHP Admin Pages / CRM (Web)
- **Why PHP/MySQL for CRM pages?**
  - Existing hosting & team familiarity; simple to host in cPanel/GoDaddy.
  - Thin layer calling HTTPS Functions for data & Firestore remains source of truth.
- **What it does:**
  - `offers_admin.php` → calls `adminOffers` actions: list/upsert/delete.
  - `App_User_Offers_Statistics.php` → calls `adminUserStats` to show **top users** and click into **user redemptions**.
  - **CRM for Radio Sales/Production** → roles and flows:
    - Sales creates campaigns (attachments).
    - Admin Sales reviews/edits → forwards to Admin Production.
    - RJ portal displays daily schedule (12am–12am), radio logs with checkboxes, timestamps.
  - **Mailgun**: sends notifications on transitions between Sales/Admin/Production and to RJs.

### D) Node/Express (Mailgun bridge)
- **Why Node/Express?**
  - Simple server to handle contact forms without exposing Mailgun keys to the client.
  - Supports mailing lists and transactional messages (e.g., partner onboarding).
- **What it does:**
  - Receives form submissions → validates → sends via Mailgun API with a **server-side key**.
  - CORS + rate-limit recommendations to prevent spam.

---

## 2) Data Model (Firestore)

```
/offers/{offerId}
  active: boolean
  clientName: string
  pointsCost: number              // cost to redeem
  daysOfWeek: number[]            // 0..6 (Sun..Sat)
  startMinuteOfDay: number        // 0..1439
  endMinuteOfDay: number          // 0..1440
  validFrom: Timestamp|null
  validTo: Timestamp|null
  expiresAfterMinutes: number     // code TTL (default 30)
  redeemedTotal: number
  dailyRedeemedOn: 'YYYY-MM-DD'
  dailyRedeemedCount: number
  imageUrl: string (optional)

/users/{uid}
  displayName, email, photoURL, uid
  providerFirst/Last, createdAt, lastLoginAt, roles[]

/users/{uid}/events/{doc}
  type: 'listening' | ...
  startedAt: Timestamp
  device: string
  ... (anything needed for auditing)

/users/{uid}/meta/points
  total: number        // points accrued (live balance if you deduct here)
  redeemed: number     // optional; if using a separate redeemed counter
  updatedAt: Timestamp

/users/{uid}/redemptions/{doc}
  code: string
  clientId: string
  pointsUsed: number
  createdAt: Timestamp
  expiresAt: Timestamp
  active: boolean

/users/{uid}/activeRedemptions/{clientId}
  code: string
  redemptionId: string
  createdAt: Timestamp
  expiresAt: Timestamp
  active: boolean
```

> **Important:** On listens, `onListeningEvent` increments `/users/{uid}/meta/points.total`. If this document does not exist, the Function creates it with `total = 0` before incrementing.

---

## 3) Security Rules (high level)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Offers are public (read-only to clients).
    match /offers/{offerId} {
      allow read: if true;
      allow write: if false; // changed via adminEndpoints only
    }

    // User-scoped data
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /events/{doc}       { allow read, write: if request.auth.uid == uid; }
      match /earnings/{doc}     { allow read, write: if request.auth.uid == uid; } // optional legacy
      match /meta/{doc}         { allow read, write: if request.auth.uid == uid; }
      match /redemptions/{doc}  { allow read: if request.auth.uid == uid; allow write: if false; }
      match /activeRedemptions/{doc} { allow read: if request.auth.uid == uid; allow write: if false; }
    }
  }
}
```

- **Rationale:** Clients may **read** offers; all **writes** to offers & redemptions go via Cloud Functions to enforce quotas & points logic.

---

## 4) Cloud Functions (Gen2)

### 4.1 `onListeningEvent` (Firestore trigger)
- **Trigger:** `google.cloud.firestore.document.v1.created` on path `users/{uid}/events/{doc}`
- **Why:** Background accrual of points per minute of listening without trusting the client.
- **Behavior:**
  - Validates the event (recent, type `listening`, reasonable rate).
  - Ensures `/users/{uid}/meta/points` exists.
  - Increments `total` by **~0.1666667** points per minute (≈10 points/hour). (Adjustable constant.)
  - Idempotence guards: event ID de-dup (if implemented), minimal spam protection.

### 4.2 `redeemOffer` (Callable)
- **Why:** Atomic & authoritative redemption with all business rules in one **transaction**.
- **Transaction steps:**
  - Read offer; validate `active`, `validFrom/To`, `daysOfWeek`, `start/endMinuteOfDay`.
  - Enforce quotas: **total** and **daily** (with `dailyRedeemedOn` reset logic).
  - Check user points (`/users/{uid}/meta/points.total >= pointsCost`).
  - **Reuse** active, unexpired code in `/activeRedemptions/{clientId}` if present.
  - Otherwise, **deduct points**, increment counters, create **history** in `/redemptions`, and upsert `/activeRedemptions/{clientId}`.
  - Return `{ code, expiresAtMs, redemptionId, alreadyHad }`.

- **Common failure codes → UI messages:**
  - `permission-denied` → “Please sign in with Google to redeem.”
  - `failed-precondition` with messages:
    - “Insufficient points.”
    - “Offer not active./Offer ended./Not started.”
    - “Wrong day./Outside hours.”
    - “Daily quota met./Total quota met.”
  - `not-found` → “Offer not found.”
  - `invalid-argument` → “Missing or invalid input.”

### 4.3 `adminOffers` (HTTP)
- **Auth:** `x-admin-secret` **or** `?secret=...` (backed by Secret Manager var `ADMIN_OFFERS_SECRET`).
- **Actions:**
  - `list` → returns offers (limit parameter).
  - `upsert` → create/update an offer; parses CSV for `daysOfWeek`, int parses for quotas/minutes.
  - `delete` → deletes an offer.
- **Why:** Simple admin integration for PHP or cURL testing.

### 4.4 `adminUserStats` (HTTP)
- **Actions:**
  - `userstop`  → top users **by points** (desc). (We support this lowercased action name.)
  - `userredemptions` → list a user’s redemptions newest first.
- **Why:** Leaderboards and per-user audit for the admin dashboard.
- **Note:** We avoided the `collectionGroup('meta') + FieldPath.documentId()` query due to a Firestore limitation (odd segments). Instead, we iterate `users` and read `/meta/points` per user in **batches**.

### 4.5 `ping` (Callable)
- **Why:** Quick connectivity & auth test.

---

## 5) Admin HTTP — cURL Tests

> Replace `PROJECT_ID`, `SECRET`, and `UID` as needed. Region **us-central1**.

**List offers**
```bash
curl -sS "https://us-central1-PROJECT_ID.cloudfunctions.net/adminOffers?action=list&limit=100&secret=SECRET"
```

**Upsert offer**
```bash
curl -sS -X POST "https://us-central1-PROJECT_ID.cloudfunctions.net/adminOffers?secret=SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "upsert",
    "id": "some-offer-id",
    "clientName": "Acme Grill",
    "active": "true",
    "pointsCost": "50",
    "daysOfWeek": "0,6",
    "startMinuteOfDay": "660",
    "endMinuteOfDay": "1320",
    "validFrom": "2025-10-20T00:00:00Z",
    "validTo": "2025-12-31T23:59:59Z",
    "expiresAfterMinutes": "30",
    "dailyQuota": "100",
    "totalQuota": ""
  }'
```

**Delete offer**
```bash
curl -sS -X POST "https://us-central1-PROJECT_ID.cloudfunctions.net/adminOffers?secret=SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"delete","id":"some-offer-id"}'
```

**Top users (leaderboard)**
```bash
curl -sS "https://us-central1-PROJECT_ID.cloudfunctions.net/adminUserStats?action=userstop&limit=50&secret=SECRET"
```

**User redemptions**
```bash
curl -sS "https://us-central1-PROJECT_ID.cloudfunctions.net/adminUserStats?action=userredemptions&uid=UID&limit=200&secret=SECRET"
```

---

## 6) Mobile UX — Key Flows

### Redeem Button Logic (on client detail sheet)
- We **check Firestore** `/offers/{id}` to confirm `active` before showing **Redeem**.
- We **stream** `/users/{uid}/activeRedemptions/{id}`:
  - If there’s a **valid active code**, hide Redeem and display **“Redeemed ✓” + Code Panel**.
  - If **no active code**, show **Redeem** (gated by Google sign-in).

### Code Panel
- Displays `code`, `expiresAt`, and **Copy** (uses `Clipboard.setData`).
- Active redemptions are **reused** by the Function to avoid generating duplicate codes.

### Account Page
- **Points Summary**: reads `/users/{uid}/meta/points` → shows **Earned**, **Redeemed** (optional), **Balance**, and **$ value** mapping example.
- **Redemption History**: lists `/users/{uid}/redemptions` newest first; **expired codes** rendered in **grayscale/“Expired”** label.
- **Guest CTA**: Encourages Google sign-in for full features.
- **Sign-out/Guest-delete**: Stops audio, clears auth.

### Listening → Points
- App logs a Firestore document every **minute** while streaming (throttled) under `/users/{uid}/events/…`.
- Function `onListeningEvent` increments points. If points doc **doesn’t exist**, it **creates** it first (prevents “no earnings” issue).

---

## 7) Deploy & IAM (Gen2 + Eventarc)

1) **Lint & build** (TypeScript)
```bash
cd functions
npm run lint -- --fix
npm run build
```

2) **Fix common ESLint/TS**: no `@ts-ignore`, trailing commas, `max-len: 80`, no duplicate imports, avoid unused imports (e.g., `FieldPath`).

3) **Deploy** (example: just one function)
```bash
firebase deploy --only functions:onListeningEvent
# or all functions
firebase deploy --only functions
```

4) **First-time Gen2 Firestore trigger? Eventarc IAM**
- Get **Project Number** (not Project ID):
```bash
gcloud projects describe PROJECT_ID --format='value(projectNumber)'
# -> e.g., 924482851867
```
- Grant **Eventarc Service Agent**:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.serviceAgent"
```
- (If needed) Allow Pub/Sub publish for Eventarc:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```
- Wait ~2–5 minutes for propagation, then **re-deploy**.

5) **Verify deploy**
```bash
firebase functions:log --only onListeningEvent
# Look for: state ACTIVE, eventTrigger set, no permission errors
```

---

## 8) Troubleshooting (Symptom → Cause → Fix)

- **Offer button shows twice / not updating**
  - Cause: not watching `/activeRedemptions/{clientId}`; stale state.
  - Fix: use `StreamBuilder<ActiveRedemption?>`; when `hasValid` → hide Redeem, show **Redeemed** & **Code Panel**.

- **Copy code underline error** in Flutter
  - Cause: missing import.
  - Fix: `import 'package:flutter/services.dart' show Clipboard, ClipboardData;`

- **“Insufficient points” when redeeming**
  - Cause: onListeningEvent not incrementing or /meta/points missing.
  - Fix: verify `onListeningEvent` is **ACTIVE**; create one dummy event to seed `/meta/points` or let the function create it automatically; check IAM Eventarc role; tail logs.

- **`adminUserStats` 400: FieldPath.documentId odd segments**
  - Cause: collectionGroup + documentId on virtual doc (`points`) is unsupported.
  - Fix: iterate `users` → read `/meta/points` per user in batches; **action name** is `userstop` (lowercased).

- **`offers_admin.php` 404**
  - Cause: file not present on server or wrong path.
  - Fix: upload PHP file to hosting, point it to `adminOffers` endpoint with `secret`.

- **Deploy error: “Permission denied while using the Eventarc Service Agent”**
  - Cause: missing IAM role for service account `service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`.
  - Fix: run **gcloud add-iam-policy-binding** (see §7). Redeploy after propagation.

---

## 9) Secrets / Config

- **Secret:** `ADMIN_OFFERS_SECRET` (in Functions → Secret Manager).  
  - Used by both `adminOffers` and `adminUserStats` via **header** `x-admin-secret` or `?secret=` query.
- **Mailgun:** keep **private API key** only on server (Node/Express), never in client app.
- **Firebase config:** standard client SDK config in Flutter. Use Firebase Console for web/app configs.

> **Never commit real secrets**. Use placeholders and environment-specific Secret Manager values.

---

## 10) Prompts the chatbot can answer (FAQ)

- “How do I test `adminUserStats` users leaderboard?”  
  → Show the cURL in §5 with `action=userstop` and explain the JSON fields.

- “Why aren’t points increasing?”  
  → Ask if `onListeningEvent` is active; confirm Eventarc IAM; check Firestore `/events` documents are being created; read function logs.

- “How does Redeem prevent double codes?”  
  → It reuses an active, unexpired code from `/activeRedemptions/{clientId}`; only creates a new one after expiry.

- “What does `pointsCost` mean and where is it enforced?”  
  → In `redeemOffer` transaction; requires `/meta/points.total >= pointsCost` before generating a code.

- “How do I add a new offer with limited weekend hours?”  
  → Use `adminOffers upsert`: set `daysOfWeek: "0,6"`, `startMinuteOfDay/endMinuteOfDay`, `validFrom/To`, and `expiresAfterMinutes`.

- “How do expired codes look in the app?”  
  → In the **Account → Redemptions**, expired are greyed with “Expired”.

---

## 11) BigFan App (Multi-station) — Short Note

- **Stack:** Flutter + Firebase.
- **Features:** Multi-station list, sort order, recommended sections, crash fixes around audio switching.
- **Notes:** Similar logging approach can accrue points across stations if desired; ensure only one station plays at a time and events throttle correctly.

---

## 12) CRM for Radio Sales / Admin Production — Short Note

- **Stack:** PHP/MySQL (or Node/Express) + Mailgun; role-based auth.
- **Flows:** Sales → Admin Sales (edits) → Admin Production → RJ portal (daily schedule 12am–12am). Email notifications on each transition. Attachments supported. Super Admin can view logs, pull activity, and manage users.
- **Outcome:** Replaces manual coordination; provides audit trails.

---

## 13) Useful Commands (one place)

```bash
# Lint & fix
npm run lint -- --fix

# TypeScript build
npm run build

# Deploy all functions
firebase deploy --only functions

# Deploy just the listener
firebase deploy --only functions:onListeningEvent

# Logs for a function
firebase functions:log --only onListeningEvent

# Get project number (for Eventarc IAM)
gcloud projects describe PROJECT_ID --format='value(projectNumber)'

# Grant Eventarc service agent
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.serviceAgent"

# (Optional) Pub/Sub publish grant
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

---

## 14) Glossary

- **Eventarc:** Infrastructure that routes Firestore events to Gen2 functions.
- **Gen2 Functions:** Second-generation Cloud Functions (Cloud Run + Eventarc); different deploy/runtime than Gen1.
- **TTL / Code expiry:** Offers return codes that expire after `expiresAfterMinutes` (default 30m).
- **Mins of Day:** 0..1439; used to bound offer redeem hours (e.g., 11:00–22:00).

---

## 15) Notes & Defaults

- Points accrual constant: **0.1666667/min** (≈10 pts/hour). Change centrally in `onListeningEvent`.
- `adminUserStats` accepts **`action=userstop`** (lowercase) for the leaderboard.
- `adminOffers` protects via **Secret Manager**; never deploy with an empty secret.
- Flutter UI shows **Redeem** button **only** if offer exists and no active code is present; otherwise shows **“Redeemed ✓”** and the **Code Panel**.
- If `/users/{uid}` profile doc appears **empty**: verify your auth listener writes on login; otherwise read from Firebase Auth profile directly in-app; Functions do not populate profile fields automatically unless you implement an `onAuth` sync function.

---

**End of document**.
