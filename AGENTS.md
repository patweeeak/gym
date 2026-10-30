# AGENTS.md — project context for AI coding agents

Read this before changing code. It describes what the app is, how it is built, the conventions to
follow, and the decisions that are easy to undo by accident. `README.md` has the human-facing
overview (run instructions, demo accounts, asset credits).

## What this is

**IronPulse Gym**: a gym management + fitness tracking **Progressive Web App** for one gym. The gym
name is editable by the owner at runtime (`db.settings.gymName`). It is used in the Philippines
(currency ₱, GCash/Maya are the relevant payment methods if payments are added).

Three roles, each with its own area and navigation:

| Role | Route prefix | What they do |
|---|---|---|
| Owner (`admin`) | `/admin` | Dashboard (revenue, membership mix, check-ins), register/edit/delete members, add/remove instructors, approve upgrade requests, renew subscriptions, classes, check-in desk, announcements, settings (gym name, prices, demo reset) |
| Instructor (`instructor`) | `/coach` | Today's classes, assigned members, member detail (goals, workout plans, coach notes, progress), classes, check-in desk, announcements. **Cannot register members.** |
| Member (`member`) | `/app` | Premium (`plan: 'monthly'`, active subscription): daily rings, GPS/accelerometer walk-run tracker, diet + macros + water, goals + weight trend, coach plans, workout history, streaks. Basic (`plan: 'basic'`, pay per visit): check-in card, visit/spend summary, starter workouts, tools, upgrade request. Both: Tools page with calculators and the 3D **Body Lab**. |

Demo accounts (also chips on the login screen): `owner@gym.com / admin123`,
`coach@gym.com / coach123`, `maria@gym.com / member123` (premium), `juan@gym.com / member123` (basic).

## Stack

- React 18 + TypeScript (strict) + Vite 5, React Router 6, `vite-plugin-pwa` (auto-update service worker).
- three.js 0.169 for the Body Lab only (lazy-loaded chunk).
- lucide-react for icons. No UI framework, no CSS framework, no state library, no test framework.
- Fonts: Bebas Neue (numbers/headlines, class `num`) + Space Grotesk (body), from Google Fonts.
- Deploy: static hosting with SPA rewrites (`vercel.json`, `public/_redirects` for Netlify). Motion
  sensors and GPS need HTTPS (or localhost).

```bash
npm install
npm run dev      # http://localhost:5173, also exposed on the LAN (--host)
npm run build    # tsc --noEmit && vite build  → dist/
npm run preview
```

There are no automated tests. Before finishing a change: `npx tsc --noEmit -p .` and `npm run build`
must pass; check UI changes in the browser (dark and light theme, desktop and phone width).

## Layout

```
src/
  main.tsx              router + AuthProvider + service worker + global press effects
  App.tsx               all routes; RequireRole guards each area, PremiumOnly gates premium pages
  lib/
    db.ts               THE data store (see below) + demo seed
    types.ts            every data type; DB is the whole persisted state
    auth.tsx            session (localStorage 'ironpulse-session' = user id), useAuth/useMe/homeFor
    utils.ts            dates (dayKey = 'YYYY-MM-DD'), formatting, money(), isPremium, daysLeft, METRIC colours
    stats.ts            derived numbers (steps/calories/water per day, streak, goal progress)
    body.ts             Body Lab option lists (skin tones, hair, outfits) + body-fat/BMI helpers
    library.ts          built-in workout routines
    useTracker.ts       live walk/run tracker (DeviceMotion step detection + GPS)
    fx.ts               toast(), haptics, confetti, press ripple
  components/
    ui.tsx              UI kit: Card, Button, IconButton, Input, Select, Textarea, Toggle, Segmented,
                        Modal, Avatar, Badge, Stat, PageHeader, Empty, Progress, Ring, Locked, AnimatedNumber
    charts.tsx          BarChart, LineChart, RouteSketch (hand-rolled SVG)
    Shell.tsx           sidebar (desktop) / header + bottom nav (phone), per-role nav, theme toggle, swipe nav
    BodyModel.tsx       the 3D Body Lab (≈1.6k lines, see its section)
    MemberCard.tsx, GoalEditor.tsx
  pages/                admin/, coach/, member/ + shared pages (Login, Announcements, CheckInDesk, ClassesManager)
  styles/neu.css        the whole design system (one file)
public/
  models/human.glb      Body Lab body (meshopt-compressed)
  models/hair/*.bin|webp  baked hair cards
  models/anims/*.glb    Mixamo animation clips (skeleton only)
  icon.svg, icon-192.png, icon-512.png   app icon (flexed biceps on an orange disc)
scripts/hair/           offline Python scripts that baked public/models/hair (not part of the build)
```

## Data: `src/lib/db.ts`

- All reads go through `useDB()` (a `useSyncExternalStore` hook) or `getDB()`; **all writes go through
  `update((d) => { ...mutate d... })`**, which clones the state, persists it and notifies subscribers.
  Never mutate the object returned by `useDB()`.
- Persistence is **localStorage** under `ironpulse-db-v1`, seeded with demo data on first run. Data is
  therefore per device/browser. Tabs stay in sync via the `storage` event.
- Swapping in a real backend (Supabase/Firebase/own API) means re-implementing this module behind the
  same `useDB`/`update` surface. Passwords are stored in plain text — demo only; a backend must hash them
  and use real auth.
- `resetDemo()` re-seeds everything **except `settings.gymName`** (the owner's chosen name survives).
- `document.title` follows `settings.gymName`. The PWA manifest name (`vite.config.ts`) is static.
- If you add a field to a persisted type, make it optional or default it when read: existing users
  already have saved data without it (see how `Tools.tsx` strips the removed `scene` field).
- Dates are day keys `'YYYY-MM-DD'` (`dayKey()`), timestamps are ISO strings.

## UI conventions

- **Neumorphism**: every surface has the page colour; depth comes only from paired light/dark shadows
  (`--raise*`) or inset shadows (`--inset*`). Use the existing classes and `ui.tsx` components; do not
  introduce flat bordered cards or another component library.
- Theme: `data-theme="light" | "dark"` on `<html>` (default dark, the "Midnight Pulse" look with orange
  neon accents). Colours are CSS variables in `neu.css` (`--bg`, `--text`, `--muted`, `--accent`,
  `--blue`, `--green`, …). Each metric owns one colour (`METRIC` in `utils.ts`) — reuse it.
- Mobile-first: the app is installed on phones. Check 390 px width; the bottom nav is used there.
- Feedback: `toast('…')` from `fx.ts` after saves; numbers animate with `AnimatedNumber`.
- Code style: TypeScript strict, function components + hooks, small helpers inline, comments only where
  the logic is not obvious (match the surrounding density). Two-space indent, single quotes.

## Feature flags (hidden on purpose — do not "fix")

- `SHOW_CLASSES = false` in `Shell.tsx`: the Classes menu button is hidden for every role; the routes and
  pages still exist. (The basic member's Home still shows class cards.)
- `SHOW_POSE_BUTTON = false` in `BodyModel.tsx`: the free-throw stance button is hidden; the stance code
  works (`api.setPose`).

## Body Lab (`src/components/BodyModel.tsx`, used by `pages/member/Tools.tsx`)

Interactive 3D body the member shapes with sex, height, weight, age, skin tone, hair style/colour and
sportswear; it idles, then works out on its own. Settings are saved per member in `db.bodyLab[userId]`
(debounced in `Tools.tsx`). The whole viewer is lazy-loaded (`React.lazy`).

How it works (all inside one `useEffect` with an imperative three.js scene; React only renders the
overlay buttons):

- **Body**: `public/models/human.glb`, a CC0 MakeHuman/MPFB base mesh with a 53-bone rig, meshopt +
  quantized. Positions are quantized, so code converts to metres via the bounding box (`unit`).
- **Shaping** happens in the vertex shader before skinning (`shaped()`): per-vertex attributes derived
  at load from skin weights (`aFat`, `aBelly`, `aGlute`, `aHip`, `aWaist`, `aBust`, …) scaled by uniforms
  (`u.uInflate`, `u.uBelly`, …) computed each frame from BMI, body fat, age and sex. Anything that must
  sit on the skin (hair, ground contact) has to apply the same offsets.
- **Sportswear** is painted per pixel in the skin shader (garment bands by bind-space height / arm
  position); loose garments are lifted a few mm. There are no clothing meshes.
- **Hair**: buzz cut = shell rendering on the scalp; other styles = MakeHuman hair cards baked offline
  (`scripts/hair/fit.py`, `bake_hair.py`) into `public/models/hair/<style>.bin|.webp`, skinned to
  head/neck/upper back and pushed off the body by `uHairPad`.
- **Animation**: Mixamo clips in `public/models/anims/` (idle, jumping-jacks, squat, jog, burpee,
  pushup, stretch) are sampled in the browser (`sampleClip`) into rows (hip/ankle offsets in leg
  lengths, joint rotations from the Mixamo T-pose, torso direction, hand gap, feet height) and
  **retargeted** each frame (`applyMocap`): bones copy rotation away from the T-pose; arm bones follow
  direction only (their roll differs); legs are re-solved with two-bone IK (knees track the toes, never
  bow outward); collarbones follow their arm; the torso is re-aligned to the performer's lean; fingers
  copy only their bend; forearms take most of the wrist roll (prevents "candy-wrapper" thinning);
  jogging and the stretch use a fist pose. The idle uses a relaxed hand and a narrowed stance.
- **Workout timeline** (`planAt`): after 4 s without input (`IDLE_S`), each exercise blends in from its
  most standing-like frame, plays whole repetitions, blends out, then a short breather. Push-ups get
  down and back up using the burpee clip (`Bridge`). Any control change returns to idle.
- **Grounding**: every frame the lowest skinned vertex (CPU-skinned sample incl. shader shaping,
  `lowestSkin()`) is set on the platform, lifted only by the clip's recorded jump height.
- **Studio only**: dark platform with a BMI-coloured ring and a height ruler. The old 360° photo scenes
  were removed on request; don't re-add them unless asked.
- Dev-only hook for screenshots: `window.__bodyLabPose = { ex, tt }` freezes exercise `ex` (0-based
  index into the exercise list) at time `tt` seconds.

Retargeting tuning is fragile and was iterated against screenshots. If you change it, check standing
(front + side), every exercise, both sexes, low/high weight and 215 cm height; look for bowed knees,
crossed feet, collapsed shoulders, thin forearms, feet through the platform and hair inside the body.

## Assets and licences

- Body mesh and hair proxies: MakeHuman/MPFB assets, **CC0**.
- Animations: **Mixamo** (Adobe). Free to use inside the app, but raw downloads must not be
  redistributed. Raw FBX files live in `assets-src/` which is **git-ignored** — keep it that way. To add
  a clip: download "without skin" from Mixamo, `FBX2glTF --binary`, then `gltf-transform meshopt`, put it
  in `public/models/anims/<id>.glb` and add it to `EXERCISES` in `BodyModel.tsx`.
- The service worker caches `/models/*.glb|bin|webp` (CacheFirst) — rename files when replacing them so
  installed apps pick up the new version.

## Known gaps / likely next work

Real backend + auth (biggest gap; everything else depends on it), online payments and renewal
reminders (GCash/Maya), push notifications, set/rep/weight workout logging with PRs, exercise library
with Body Lab demos, progress photos and measurements, class booking with waitlist (Classes UI is
currently hidden), wearable sync (Health Connect / Apple Health), challenges/leaderboards, coach chat,
an owner retention dashboard, and Philippine Data Privacy Act compliance (consent, export, deletion).
