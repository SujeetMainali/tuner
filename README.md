# Bina 17 Tuner

A mobile-first, key-by-key tuner for the Bina 17 harmonium (42 keys, double reed). It listens through the
microphone and shows each key's deviation in cents, beat rate and steadiness. It saves a reading per key and
reed bank, then gives step-by-step tuning instructions for every key based on what it measured: direction
and amount, steadiness, the reed's register, progress since the last reading, agreement with the other reed
bank, and whether the whole instrument sits at a different pitch.

Built with React and Vite. No backend: readings are stored in the browser (`localStorage`).

![Bina 17 Tuner on desktop: live reading of C4 at +6.2 cents, with the selected key's instructions alongside](docs/screenshots/desktop-light.png)

## Features

- **Live reading.** Shows the swara in Devanagari, the Western note name and the cents deviation, with a
  strobe and a ±50¢ meter. Also shows measured and target frequency, beat rate and steadiness.
- **Three reed banks.** Bass (16'), Male (8') and Female (4') each get their own targets and readings.
- **Find the key automatically, or lock one.** Hold a key steady for about a second and the reading saves
  itself.
- **Equal temperament or just intonation.** Uses 5-limit just ratios from a Sa you choose, with A4
  adjustable.
- **Instructions for each key.** Tells you which end of the reed tongue to work and roughly how much. It
  also reports overshoot and progress from earlier readings, and warns when the reed banks disagree.
- **Report.** Shows every key with its status and the action to take. Copy it to a spreadsheet or export it
  as CSV.
- **Light and dark themes** that follow the system setting.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/mobile-live.png" alt="Phone: live reading of C4, 6.2 cents sharp, with strobe and meter"></td>
    <td width="50%"><img src="docs/screenshots/mobile-key.png" alt="Phone: selected key sheet with targets on each reed bank and step-by-step reed instructions"></td>
  </tr>
  <tr>
    <td align="center"><sub>Live reading on a phone</sub></td>
    <td align="center"><sub>What to do for the selected key</sub></td>
  </tr>
</table>

**Keyboard.** Each of the 42 keys shows its last reading and a status colour. Tap a key to inspect it.

![Keyboard overview with per-key cents and in-tune, close, needs-work and untested markers](docs/screenshots/keyboard.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/report.png" alt="Tuning report for the Male reeds: summary and per-key table"></td>
    <td width="50%"><img src="docs/screenshots/key-sheet.png" alt="Key sheet for C4 with readings on each bank, instructions and history"></td>
  </tr>
  <tr>
    <td align="center"><sub>Tuning report and CSV export</sub></td>
    <td align="center"><sub>Key detail with reading history</sub></td>
  </tr>
</table>

<details>
<summary>Dark theme</summary>

![Bina 17 Tuner in dark theme](docs/screenshots/desktop-dark.png)

</details>

## How to tune with it

1. Open only one reed-bank stop (Bass or Male) and keep the drone stops shut.
2. Select the same bank in the app. Place the phone 20–30 cm from the reed board in a quiet room.
3. Pump the bellows to your normal playing pressure and hold each key for about two seconds.
4. Work through all 42 keys, then switch banks and repeat.
5. Follow each key's instructions. Scrape at the free tip to raise the pitch and near the rivet to lower
   it, a little at a time, measuring after each round. Old reeds are brittle. If you are unsure, take the
   report to a harmonium technician.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # pitch-detection and tuning maths tests
npm run build    # production build in dist/
```

The microphone only works on `localhost` or over HTTPS. To test on a phone, use the deployed site.

## Deploy to Vercel

Either:

- Push this folder to a GitHub, GitLab or Bitbucket repository. In Vercel, choose **Add New → Project**,
  import the repository and press **Deploy**. Vercel detects Vite, and `vercel.json` pins the build command
  and output folder.
- Or, from this folder, run `npx vercel` for the first deploy and a preview, then `npx vercel --prod`.

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
docs/screenshots/         images used in this README
```
