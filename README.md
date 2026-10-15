# Bina 17 Tuner

A mobile-first, key-by-key tuner for the Bina 17 harmonium (42 keys, double reed). It listens through the
microphone and shows each key's deviation in cents, beat rate and steadiness, saves a reading per key and
reed bank, and gives step-by-step tuning instructions for every key based on what it measured: direction
and amount, steadiness, the reed's register, progress since the last reading, agreement with the other reed
bank, and whether the whole instrument sits at a different pitch.

Built with React and Vite. No backend: readings are stored in the browser (`localStorage`).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pitch-detection and tuning maths tests
npm run build    # production build in dist/
```

The microphone only works on `localhost` or over HTTPS, so test on a phone through the deployed site.

## Deploy to Vercel

Either:

- Push this folder to a GitHub, GitLab or Bitbucket repository, then in Vercel choose **Add New → Project**,
  import the repository and press **Deploy**. Vercel detects Vite; `vercel.json` pins the build command and
  output folder.
- Or, from this folder, run `npx vercel` (first deploy and preview) and `npx vercel --prod`.

Vercel serves over HTTPS, so the microphone works on phones. `vercel.json` also sends
`Permissions-Policy: microphone=(self)`.

## Project layout

```
src/
  lib/dsp.js              YIN pitch detection, key targets (equal / just), reed advice
  lib/instructions.js     per-key tuning instructions built from the readings
  lib/report.js           CSV and copy-to-spreadsheet report
  lib/format.js           formatting, per-key status, short actions
  hooks/useTuner.js       microphone, detection loop, steady-hold auto-save, reference tone
  hooks/useTuningStore.js settings and saved readings, persisted to localStorage
  components/             Readout, Strobe, Meter, Controls, Keyboard, KeySheet, Instructions, Report, ...
tests/                    accuracy tests (within 0.1 cent from C2 to F6) and instruction tests
```
