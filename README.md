# IronPulse Gym

Gym management + fitness tracking app with a **neumorphism** UI. It is a Progressive Web App (PWA):
one codebase that runs in any browser and can be **installed on Android / iPhone** from the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN)
npm run build      # production build -> dist/
npm run preview    # serve the production build
```

Demo accounts (tap the chips on the login screen):

| Role | Email | Password |
|---|---|---|
| Owner / Admin | owner@gym.com | admin123 |
| Instructor | coach@gym.com | coach123 |
| Premium member | maria@gym.com | member123 |
| Basic member | juan@gym.com | member123 |

## Roles

- **Owner (admin)**: dashboard (revenue, membership mix, check-ins), register/edit/delete members,
  add/remove instructors, approve upgrade requests, renew subscriptions, classes, check-in desk,
  announcements, pricing settings.
- **Instructor**: today's classes, assigned members, member detail (set body goals, write workout plans,
  coach notes, see weight/steps progress), manage own classes, check-in desk, announcements.
  **Cannot register members.**
- **Premium (monthly) member**: daily rings (steps / calories / water), live run & walk tracker
  (accelerometer step counting + GPS distance, pace, route), diet tracker with macros and water,
  body goals with weight trend + BMI, coach-assigned workout plans, workout history, all classes,
  achievements and streaks.
- **Basic (pay-per-visit) member**: digital check-in card, monthly visit/spend summary with a
  "monthly pays for itself after N visits" nudge, open (non-premium) class booking, free starter
  workouts, fitness calculators (BMI, daily calories, 1-rep max), gym announcements, locked previews of
  premium features, and an in-app upgrade request that the owner approves.

## Installing on a phone

Deploy `dist/` to any static host with HTTPS (Vercel, Netlify, Cloudflare Pages; SPA rewrite files are
included). Open the URL on the phone, then:
- **Android / Chrome**: menu → *Install app* / *Add to Home screen*
- **iPhone / Safari**: Share → *Add to Home Screen*

The step tracker uses motion sensors and GPS, which browsers only allow over **HTTPS**
(or `localhost`). On iPhone the app asks for motion permission when you press start.

## Data / backend

All reads and writes go through `src/lib/db.ts` (`useDB()` / `update()`). Right now it saves to the
browser's localStorage with seeded demo data, so **data is per-device**. To make it a real multi-user
online system, replace that module with a hosted backend (e.g. Supabase or Firebase: auth, a
Postgres/Firestore database, and row-level security per role). Passwords must then be handled by the
backend's auth, not stored in plain text as in this demo.

## 3D body model

The Tools page ("Body Lab") uses `public/models/human.glb`, the
[Innerscene human base mesh](https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1)
(built from MakeHuman/MPFB assets, **CC0**), compressed with `npx @gltf-transform/cli meshopt`.

- **Shaping** (`src/components/BodyModel.tsx`): height scales the figure; weight, sex and age reshape it in
  the vertex shader, by region, using the skin weights.
- **Hair**: MakeHuman hair proxies (CC0) fitted offline to this body's head and baked to
  `public/models/hair/*.bin` + `*.webp` by `scripts/hair/fit.py` and `scripts/hair/bake_hair.py`.
- **Sportswear** is painted onto the skin in the shader (loose garments are lifted a few mm).
- **Movement**: [Mixamo](https://www.mixamo.com) animations (Adobe; free to use in projects, but the raw
  files may not be redistributed on their own) in `public/models/anims/*.glb`: idle, jumping-jacks, squat,
  jog, burpee, pushup, stretch (30-60 KB each, skeleton only). They are sampled in the browser into each
  joint's rotation away from the Mixamo T-pose, then retargeted onto this skeleton with a per-bone
  rest-pose correction, and the legs are re-solved with IK so the feet land where the performer's did
  (scaled to this body). The idle plays all the time; after 4 s without input the workout cycles through
  the exercises (about 9 s each). The raw Mixamo downloads live in `assets-src/mixamo/` (git-ignored, not
  deployed). To convert a new one: `FBX2glTF --binary --input x.fbx --output x`, then
  `gltf-transform meshopt`.
- **Saved per member**: stats, look, outfit and activity level are stored in `db.bodyLab[userId]`
  and restored on the next visit.
- **Background**: a studio platform with a BMI-coloured ring and a height ruler.

## Structure

```
src/
  styles/neu.css         neumorphism design system (light + dark)
  lib/                   types, data store + seed, auth, stats, step tracker hook, workout/food library
  components/            UI kit (Card, Button, Ring, Toggle, Modal…), charts, Shell (sidebar + bottom nav)
  pages/admin|coach|member + shared pages (classes, check-in desk, announcements)
```
