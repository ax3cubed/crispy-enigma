# LTI 1.3 / LTI Advantage — Test Plan & Setup Guide

## Overview

This document covers how to validate the `crispy-enigma` LTI 1.3 Advantage tool against **saLTIre** (`https://saltire.lti.app`) as the free LMS/platform simulator.

**Standards in scope:** LTI 1.3 Core · AGS 2.0 · NRPS 2.0 · Deep Linking 2.0

**Key rule:** QTI defines assessment/rubric *structure*. It does **not** submit grades to the LMS. Grade passback is exclusively handled by **AGS**.

---

## 1. Environment Setup

### 1.1 Install and run

```bash
git clone https://github.com/ax3cubed/crispy-enigma.git
cd crispy-enigma
cp .env.example .env.local
npm install
npm run dev
# Server starts at http://localhost:3000
```

For saLTIre to reach your local server, expose it publicly using ngrok:

```bash
npx ngrok http 3000
# Copy the https://abc123.ngrok.io URL — use it as TOOL_BASE_URL in .env.local
```

### 1.2 Environment variables

Copy `.env.example` to `.env.local` and fill in the values from saLTIre after registration:

```env
# ── Required ──────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
LTI_KEY=your-random-64-char-hex-key-here

LTI_DB_PATH=./lti.db
APP_DB_PATH=./app.db

# ── Filled from saLTIre after tool registration ───────────────────
PLATFORM_URL=https://saltire.lti.app
PLATFORM_CLIENT_ID=          # provided by saLTIre
PLATFORM_AUTH_ENDPOINT=https://saltire.lti.app/platform/auth
PLATFORM_TOKEN_ENDPOINT=https://saltire.lti.app/platform/token
PLATFORM_JWKS_URL=https://saltire.lti.app/platform/jwks

# ── Your public tool URL (ngrok or deployed) ──────────────────────
TOOL_BASE_URL=https://abc123.ngrok.io
```

---

## 2. saLTIre Registration

1. Go to `https://saltire.lti.app` → **Platform** tab → **New Tool**
2. Enter these values:

| Field | Value |
|---|---|
| OIDC Login URL | `https://<TOOL_BASE_URL>/lti/login` |
| Launch / Redirect URL | `https://<TOOL_BASE_URL>/lti/launch` |
| Deep Linking URL | `https://<TOOL_BASE_URL>/lti/launch` |
| JWKS URL | `https://<TOOL_BASE_URL>/lti/keys` |
| Target Link URI | `https://<TOOL_BASE_URL>/lti/launch` |

3. Enable: **AGS**, **NRPS**, **Deep Linking** in the platform settings
4. saLTIre will provide a `client_id` → paste it into `.env.local` as `PLATFORM_CLIENT_ID`
5. Restart the server: `npm run dev`

---

## 3. Test Flows

### A. LTI 1.3 Authentication

**Steps:**
1. In saLTIre, trigger a **Resource Link** launch with role = `Instructor`
2. saLTIre POSTs to `/lti/login` → tool redirects to saLTIre auth endpoint → saLTIre POSTs `id_token` to `/lti/launch`
3. ltijs validates JWT signature (via saLTIre JWKS), checks `iss`, `aud`, `nonce`, `exp`
4. Browser redirects to `/instructor`

**Pass criteria:**
- No 401 or redirect loop
- `/instructor` page loads and shows LTI context (user ID, course ID, AGS/NRPS availability)

**Failure modes:**
- `Invalid token` → wrong `PLATFORM_JWKS_URL` or `PLATFORM_CLIENT_ID`
- Redirect loop → `LTI_KEY` not set or cookie config mismatch
- 404 on launch → wrong Launch URL registered in saLTIre

---

### B. Instructor Launch

**Steps:**
1. Launch from saLTIre with role `http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor`
2. Tool reads `roles` claim → redirects to `/instructor`
3. Instructor Dashboard shows: User ID, Course ID, AGS status, NRPS status

**Pass criteria:**
- Role shown as `Instructor` (purple badge)
- AGS and NRPS show **Available** if enabled in saLTIre

---

### C. Learner Launch

**Steps:**
1. Launch from saLTIre with role `http://purl.imsglobal.org/vocab/lis/v2/membership#Learner`
2. Tool redirects to `/tool`
3. Rubric form renders with 4 criteria (Content Quality, Critical Analysis, Evidence & Sources, Presentation)

**Pass criteria:**
- Role shown as `Learner` (blue badge)
- All rubric criteria visible and scoreable (0–5 buttons)

---

### D. Deep Linking (Assessment Configuration)

**Steps:**
1. In saLTIre, trigger a **Deep Linking** launch
2. Tool detects `LtiDeepLinkingRequest` message type → redirects to `/deep-link`
3. Instructor fills in: Assessment Title, Description, Rubric, Max Score → clicks **Link Assessment to LMS**
4. Tool POSTs to `/api/lti/deep-link/response` → ltijs builds signed `LtiDeepLinkingResponse` JWT → auto-submitting form POSTs back to saLTIre

**Pass criteria:**
- saLTIre confirms content item received
- Returned item contains `type: ltiResourceLink`, `lineItem.scoreMaximum`, and `custom.assessment_id`

**What this proves:** The Deep Linking flow is the standard way to detect that an instructor has configured/linked an assessment. Detecting QTI uploads or file imports requires vendor-specific LMS APIs — not possible via standard LTI.

---

### E. NRPS — Course Roster

**Steps:**
1. Launch as instructor → go to **Roster** tab
2. Click **Refresh** → tool GETs `/api/lti/roster` → ltijs calls NRPS `context_memberships_url`

**Pass criteria:**
- Member list returns with `user_id`, `name`, `roles`, `status`
- Instructors and learners correctly identified from role URIs

**Failure mode:**
- `NRPS_NOT_AVAILABLE` → NRPS not enabled in saLTIre platform config

---

### F. AGS — Line Items

**Steps:**
1. Launch as instructor → go to **Grades** tab
2. Tool GETs `/api/lti/lineitems` → lists grade columns from saLTIre

**Pass criteria:**
- Returns array (may be empty before first score is submitted)
- Each item has `id` (URL), `label`, `scoreMaximum`

---

### G. Rubric Scoring + Grade Passback

**Steps:**
1. Launch as learner → `/tool` page loads with rubric
2. Score all 4 criteria (click a point value 0–5 for each)
3. Click **Submit Assessment Score**
4. Tool POSTs to `/api/rubrics/compute-score` → weighted score computed
5. Tool GETs `/api/lti/lineitems` → finds or creates a line item
6. Tool POSTs to `/api/lti/scores` with:

```json
{
  "userId": "<sub from JWT>",
  "scoreGiven": 17.5,
  "scoreMaximum": 25,
  "activityProgress": "Completed",
  "gradingProgress": "FullyGraded",
  "timestamp": "2026-04-03T14:30:00Z",
  "comment": "Content Quality: 4/5 | Critical Analysis: 5/5 | Evidence & Sources: 3/5 | Presentation: 4/5 | Total: 80.0%"
}
```

**Pass criteria:**
- Score summary page shows percentage and criteria breakdown
- saLTIre AGS endpoint returns 200
- Rubric breakdown visible in the AGS `comment` field

**Important:** The `comment` field is the **only standard way** to surface rubric detail in the LMS gradebook via LTI. QTI may define rubric criteria structure, but AGS is the only grade passback channel.

---

### H. Negative Tests

| Test | How to trigger | Expected result |
|---|---|---|
| Expired JWT | Replay an old `id_token` | 401 `INVALID_LTI_TOKEN` |
| Wrong `aud` | Change `client_id` in saLTIre | 401 invalid token |
| Learner accessing AGS write | POST to `/api/lti/scores` as learner | Should reject (AGS scope not granted to learners) |
| No AGS claim | Disable AGS in saLTIre, try to submit score | `AGS_NOT_AVAILABLE` error |
| No NRPS claim | Disable NRPS in saLTIre, open Roster tab | `NRPS_NOT_AVAILABLE` error |
| Missing lineItemId | POST `/api/lti/scores` without `lineItemId` | 400 `INVALID_BODY` |

---

## 4. Claims Checklist

Inspect the `id_token` JWT in the browser or saLTIre's debug panel:

| Claim | Expected value | Why it matters |
|---|---|---|
| `iss` | `https://saltire.lti.app` | Platform identity |
| `aud` | Your `PLATFORM_CLIENT_ID` | Prevents token reuse across tools |
| `sub` | Opaque user ID string | Used as `userId` in AGS score POST |
| `nonce` | Unique per request | Replay prevention |
| `https://purl.imsglobal.org/spec/lti/claim/message_type` | `LtiResourceLinkRequest` or `LtiDeepLinkingRequest` | Determines which flow to run |
| `https://purl.imsglobal.org/spec/lti/claim/version` | `1.3.0` | Spec compliance |
| `https://purl.imsglobal.org/spec/lti/claim/deployment_id` | String from saLTIre | Multi-tenancy |
| `https://purl.imsglobal.org/spec/lti/claim/roles` | Array of LIS URIs | Instructor vs Learner routing |
| `https://purl.imsglobal.org/spec/lti/claim/context` | `{id, label, title}` | Course identification |
| `https://purl.imsglobal.org/spec/lti/claim/resource_link` | `{id, title}` | Which placement launched |
| `https://purl.imsglobal.org/spec/lti-ags/claim/endpoint` | `{lineitems, lineitem, scope}` | AGS service URLs |
| `https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice` | `{context_memberships_url}` | NRPS service URL |
| `https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings` | `{deep_link_return_url, accept_types}` | Deep Linking return target |
| `https://purl.imsglobal.org/spec/lti/claim/custom` | `{assessment_id, rubric_id}` | Custom params from Deep Linking |

---

## 5. QTI vs AGS — Quick Reference

| | QTI | AGS |
|---|---|---|
| Purpose | Define assessment/rubric structure | Submit grades to LMS gradebook |
| Part of LTI? | No (separate IMS standard) | Yes (LTI Advantage service) |
| Returns grades to LMS? | **No** | **Yes** |
| How rubric detail reaches LMS | N/A | Via AGS score `comment` field (plain text) |
| Tested with saLTIre? | No — QTI is tool-internal | Yes — saLTIre has AGS endpoints |

---

## 6. After saLTIre — Next Steps

saLTIre confirms protocol correctness. Before production, test against a real LMS:

| LMS | Free option | What it adds |
|---|---|---|
| **Canvas** | Free for Teachers (`canvas.instructure.com`) | Real gradebook UI, real student accounts |
| **Moodle** | Local Docker install | Full gradebook, QTI import, file uploads |
| **Open edX** | Tutor (local) | Different AGS implementation nuances |

**Go / No-Go criteria:**
- All flows A–H pass against saLTIre
- AGS score POST returns 200 with correct `scoreGiven`/`scoreMaximum`
- JWT validation rejects expired, wrong-audience, and replayed tokens
- Role-based access enforced (learner cannot trigger instructor-only paths)
