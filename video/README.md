## Da Nang Hub Walkthrough Video

This `video/` directory contains a standalone [Remotion](https://www.remotion.dev/) project that renders the **Da Nang Blockchain Hub member journey** walkthrough.

### Structure

- `package.json` – Remotion project dependencies and scripts
- `remotion.config.ts` – Global Remotion configuration
- `tsconfig.json` / `eslint.config.mjs` – TypeScript and linting setup
- `screens.json` – Manifest describing the walkthrough slides
- `src/Root.tsx` – Registers the `MemberWalkthrough` composition
- `src/WalkthroughComposition.tsx` – Sequences slides based on `screens.json`
- `src/ScreenSlide.tsx` – Single-screen layout with zoom + fade and progress bar
- `public/screens/` – Place captured screenshots from the app here

### 1. Capture Screenshots

1. From the app root, start the dev server:

```bash
npm run dev
```

2. In your browser, capture 1280×720 (or larger) screenshots for these states:

- `screens/home.png` – Public home page (`/`)
- `screens/login.png` – Login page (`/login`)
- `screens/profile.png` – Member profile page (`/member/profile`)
- `screens/member-dashboard.png` – Member dashboard (`/member/dashboard`)
- `screens/booking.png` – Member bookings page with calendar (`/member/bookings`)
- `screens/events.png` – Member events page (`/member/events`)

Save the PNG files into:

```text
video/public/screens/
```

The `imagePath` fields in `screens.json` already point to these filenames.

### 2. Run Remotion Studio

From the `video/` directory:

```bash
cd video
npm run dev
```

Then open the URL printed in the terminal to preview the `MemberWalkthrough` composition, tweak timing, and verify transitions.

### 3. Render the Video

Render an MP4 file from the `video/` directory:

```bash
cd video
npx remotion render MemberWalkthrough output.mp4
```

You can adjust resolution, codec, and quality using the Remotion CLI flags if needed (see the Remotion docs for details).

### 4. Optional: Add Voiceover

1. Write a short script that narrates each screen in `screens.json` (you can reuse the `description` text as a starting point).
2. Record or generate an audio file and save it as:

```text
video/public/audio/member-walkthrough.mp3
```

3. In `src/WalkthroughComposition.tsx`, import Remotion's `<Audio>` component and add it at the top level of the composition so the narration starts at frame 0 and runs for the full duration.
4. If needed, slightly adjust the `duration` values in `screens.json` so that the visual pacing matches the narration.

