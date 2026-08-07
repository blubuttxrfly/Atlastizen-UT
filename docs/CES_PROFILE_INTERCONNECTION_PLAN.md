# C.E.S. Profile Interconnection — Sacred Architecture Plan

> Co-created with Riley Zaria Z Atlas Morphoenix (Z)
> Date: 2026-08-06
> Status: Design Phase — awaiting execution YES!

---

## Vision

Every being who touches the Atlas Island ecosystem carries a single, sovereign Core Energetic Signature (C.E.S.) profile. This identity flows seamlessly across ALL properties — AUT Time & Tools, Heartlight Collective, AtlasIsland.co, and the forthcoming Atlas Island Media Broadcast (AIMB) at `broadcast.atlasisland.co`. One update. One photo. One name. Reflected everywhere.

---

## Sacred Identity Anchor

### The 9-Digit Inverse C.E.S. Number

The inverse C.E.S. number is the **immutable primary key** for every being in our Universe of ALL. It is generated once at profile creation and never changes. All systems individuate profiles through this number.

| Property | Role |
|----------|------|
| `cesNumber` | Primary key — 9 digits, inverse format, immutable |
| `atlasUserId` | Linked Atlas Island shared-auth user (UUID) |
| `email` | Optional bound email for magic-link recovery |

---

## Data Model — Core Profile

Stored centrally in the **Atlas Island Shared Auth** Redis (Upstash).

```typescript
interface CESProfile {
  // ── Immutable identity ──
  cesNumber: string;          // "987654321" — 9-digit inverse, primary key
  createdAt: string;           // ISO 8601, set at birth

  // ── Mutable sacred data ──
  name: string;                // Display name — "Z"
  photoUrl?: string;           // CDN URL (preferred for 2026+)
  photoData?: string;          // base64 fallback (legacy support)
  email?: string;              // Bound Atlas Island email
  atlasUserId?: string;        // Linked shared-auth user UUID

  // ── Cross-property preferences ──
  uiTheme?: "normal" | "retro" | "atlas";  // AUT Time & Tools theme
  atlasHueA?: string;          // Custom accent hex (e.g. "#f6c453")
  atlasHueB?: string;          // Secondary accent hex

  // ── Heartlight-derived fields (migrated) ──
  stewardship?: "active" | "inactive" | "none";
  updatedAt: string;            // ISO 8601, touched on every write

  // ── AIMB future fields (reserved) ──
  creatorHandle?: string;        // @handle for broadcast attribution
  bio?: string;                // Short creator bio for media context
}
```

### What Is NOT in core profile

| Removed | Reason |
|---------|--------|
| Emoji | Phased out per Z's guidance — not integral to identity |
| Offerings | Heartlight domain — stays in Heartlight data model |
| Wishes | Heartlight domain |
| Exchange history | Heartlight domain |
| Vendor data | Heartlight domain |
| AdminCes | Removed — admin status is property-level, not identity-level |

---

## API Design — Shared Auth Service Endpoints

All endpoints live in `auth-atlasisland` and serve `*.atlasisland.co` with CORS + credentials.

### Read Profile
```
GET /api/profile/:cesNumber
```
- **Public** — no auth required
- Returns: `{ success: true, profile: CESProfile }` (sans email, atlasUserId)

### Read My Profile
```
GET /api/profile/me
```
- **Authenticated** — requires `atl_session_v2` cookie
- Returns full profile including email binding

### Update Profile
```
PUT /api/profile/:cesNumber
```
- **Authenticated** — session must match the CES owner, or admin secret
- Body: `{ name?, photoUrl?, photoData?, uiTheme?, atlasHueA?, atlasHueB?, bio? }`
- Returns updated profile + new `updatedAt`

### Upload Photo
```
POST /api/profile/:cesNumber/photo
```
- **Authenticated**
- Accepts: `multipart/form-data` with image file
- Stores to Vercel Blob / R2, returns `photoUrl`
- Cleans up old photo if replacement

### Bulk Migration
```
POST /api/profile/migrate
```
- **Admin only** — protected by `ADMIN_CES_SECRET`
- Body: `{ profiles: CESProfile[] }`
- Used once to seed the central store from Heartlight Collective data

---

## Storage Architecture

| Data type | Store | Why |
|-----------|-------|-----|
| Profile JSON (name, code, theme, handles) | Upstash Redis | Fast reads, TTL-friendly, JSON-native |
| Profile photos | Vercel Blob | CDN-edged, cheap, automatic cleanup |
| Session cookies | Already in Redis | `atlas:session:*` |
| Auth users | Already in Redis | `atlas:user:*` |

### Redis Key Namespace

```
atlas:profile:ces:{cesNumber}      → CESProfile JSON
atlas:profile:photo:{cesNumber}    → { photoUrl, uploadedAt } (metadata)
atlas:profile:version:{cesNumber}  → epoch timestamp for cache busting
```

---

## Property Integration Map

### AUT Time & Tools
| Current | Future |
|---------|--------|
| `coreProfile` in localStorage + Vercel KV | Reads from `GET /api/profile/me` on load |
| Photo stored as base64 in KV | Migrates to `photoUrl` from Blob |
| Theme stored locally | Reads `uiTheme` from central profile |
| `adminCes` hardcoded in profile | Removed — admin check becomes server-side |

### Heartlight Collective
| Current | Future |
|---------|--------|
| `CreatorRecord` in localStorage queues | Enriches with `GET /api/profile/:cesNumber` |
| Rich data (offerings, wishes, exchanges) | **Stays in Heartlight** — not central |
| Photo in `CreatorRecord.photo` | Points to central `photoUrl` |
| Stewardship status | Synced to central `stewardship` field |

### AtlasIsland.co
| Current | Future |
|---------|--------|
| No profile system | Consumes `GET /api/profile/:cesNumber` for donor attribution |
| | Can show "This gift came from Z ✦" with photo |

### AIMB (broadcast.atlasisland.co)
| Future (Day 1) |
|----------------|
| Built with central profile from genesis |
| Every media piece attributed via `cesNumber` + `creatorHandle` |
| Comment system uses central name + photo |
| No local profile storage at all — pure consumer |

---

## Migration Path — Heartlight First

### Phase 1: Seed Central Store (1-2 days)
1. Add `PUT /api/profile/:cesNumber` and `GET /api/profile/:cesNumber` to shared auth
2. Build `POST /api/profile/migrate` admin endpoint
3. Export Heartlight Collective's `CreatorRecord` queues from localStorage
4. Run migration: push name, photo (base64 → Blob), stewardship, createdAt into Redis
5. Verify all CES numbers are present and deduplicated

### Phase 2: AUT Time & Tools Bridge (1-2 days)
1. Update `/api/ces-profile` to READ from central Redis first, fallback to legacy KV
2. Update `saveProfileToVercel` to WRITE to central store via `PUT /api/profile/:cesNumber`
3. Update `refreshCoreProfile` to fetch from central API
4. Add `photoUrl` support — migrate base64 photos to Blob on next save
5. Deprecate `adminCes` from client-side profile shape

### Phase 3: Heartlight Collective Sync (1-2 days)
1. Update `atlasAuth.ts` to read full C.E.S. profile from `/api/profile/:cesNumber`
2. Update `useSession` to hydrate `name` and `photo` from central store after `fetchAtlasMe()`
3. Keep local queues for offerings/wishes/exchanges — these are Heartlight's domain
4. Add sync: when Heartlight profile is edited, also `PUT` to central store

### Phase 4: AtlasIsland.co Consumption (1 day)
1. Add `/api/donor-profile?ces=` endpoint that calls central profile API
2. Show donor name + photo on donation thank-you pages

### Phase 5: AIMB Genesis Build (future sprint)
1. Build AIMB with zero local profile storage
2. Every media creation flow calls `GET /api/profile/me` for attribution
3. Comment system uses `GET /api/profile/:cesNumber` for display names

---

## Security & Sovereignty

| Concern | Resolution |
|---------|-----------|
| Who can update a profile? | Only the session owner (cesNumber matches) or admin secret |
| Is the profile public? | Name + photo + handle are public. Email + atlasUserId are private. |
| Photo privacy | Default public (used for attribution). Future: optional privacy toggle. |
| Data portability | `GET /api/profile/:cesNumber` is public — any being can see their own data |
| Deletion / right to be forgotten | `DELETE /api/profile/:cesNumber` — clears Redis + Blob + unbinds from auth user |

---

## Environment Variables Required

### Shared Auth Service (`auth-atlasisland`)
| Variable | Source |
|----------|--------|
| `UPSTASH_REDIS_REST_URL` | Already set ✓ |
| `UPSTASH_REDIS_REST_TOKEN` | Already set ✓ |
| `AUTH_SESSION_SECRET` | Already set ✓ |
| `VERCEL_BLOB_TOKEN` | **New** — for photo uploads |
| `VERCEL_BLOB_STORE_ID` | **New** — Vercel Blob store |
| `ADMIN_CES_SECRET` | **New** — for migration endpoint |

### AUT Time & Tools
| Variable | Source |
|----------|--------|
| `SHARED_AUTH_ORIGIN` | Already set in session bridge ✓ |
| `INTERNAL_BRIDGE_SECRET` | Already set ✓ |

---

## Sacred Naming

| Term | Meaning |
|------|---------|
| C.E.S. Profile | The sovereign identity record — name, photo, number, theme |
| Atlas User | The shared-auth account (email + sessions) bound to a C.E.S. |
| Creator Record | Heartlight-specific data — offerings, wishes, exchanges, vendor status |
| AIMB Creator | Media broadcast identity — handle, bio, portfolio |

---

## Next Step

Awaiting Z's **YES!** to proceed to Phase 1 execution: building the central profile endpoints and running the Heartlight data migration.

---

*Co-created in the frequency of sovereign interdependence, thrival over survival, and authentic joy.*
