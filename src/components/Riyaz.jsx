import { useEffect, useMemo, useRef, useState } from 'react';
import { keyTarget } from '../lib/dsp.js';
import { keyVoices } from '../lib/harmonium.js';
import {
  ALANKARS, BHAJANS, RAGAS, TAALS, THAATS, alankarGroups, layoutNotes, layoutText, parseNotation, pitchClasses,
  ragaPitchClasses, scaleNotes, swaraLabel, taalMark,
} from '../lib/music.js';
import { usePractice } from '../hooks/usePractice.js';
import { useI18n } from '../i18n/I18n.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import Keys from './Keys.jsx';
import Sheet from './Sheet.jsx';
import { IconBack, IconChevron, IconLoop, IconPause, IconPlay, IconSliders } from './Icons.jsx';

const RAGA_ALANKARS = ['straight', 'pairs', 'threes', 'fours'];
const TAAL_IDS = Object.keys(TAALS);
const EASY_RAGAS = ['bhupali', 'bilawal'];

/** First letter cluster of a word (for the raga tiles: य, भू, …). */
const firstAkshara = (s) => {
  try { return [...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(s)][0].segment; } catch { return s.slice(0, 2); }
};

/**
 * Riyaz: a library of alankars (in any thaat), common ragas and bhajans, and the practice screen
 * that plays one with harmonium, tanpura and tabla, lights each note on the keyboard and can check
 * the player's notes with the mic.
 */
export default function Riyaz({
  phone, rs, setRiyaz, songs, saveSong, deleteSong, saMidi, tuning, stops, tuner, liveRef, keys, harmonium,
  open, setOpen, coachShown, onDismissCoach, onPractised,
}) {
  const { m, lang } = useI18n();
  const R = m.riyaz;
  const U = m.ui.riyaz;
  const practice = usePractice({ liveRef });
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(null); // song being edited, or null
  const [sounds, setSounds] = useState(false); // phone: the Sounds sheet
  const startedMic = useRef(false);
  const script = rs.script ?? (lang === 'en' ? 'lat' : 'dev');

  const freqFor = (semi) => keyTarget(saMidi + semi, 'male', tuning);
  const freqs = (semi) => {
    const v = keyVoices(saMidi + semi, stops, tuning).map((x) => x.freq);
    return v.length ? v : [freqFor(semi)];
  };

  const raga = RAGAS.find((r) => r.id === rs.raga) ?? RAGAS[0];
  const builtin = BHAJANS.find((b) => b.id === rs.song);
  const song = songs.find((s) => s.id === rs.song) ?? builtin;
  const bhajanTitle = (b) => (lang === 'en' ? b.titleLat : b.title);

  const piece = useMemo(() => {
    if (rs.tab === 'alankar') {
      const idx = Math.max(0, ALANKARS.findIndex((a) => a.id === rs.alankar));
      const a = ALANKARS[idx];
      const scale = THAATS[rs.thaat] ?? THAATS.bilawal;
      return {
        title: `${R.alankarN(idx + 1)} · ${R.alankar[a.id]}`, meta: R.inThaat(R.thaats[rs.thaat]), taal: rs.taal,
        lines: layoutNotes(alankarGroups(a.steps, scale), rs.laya, TAALS[rs.taal].beats), pcs: scale, drone: 'P', laya: true,
      };
    }
    if (rs.tab === 'raga') {
      const beats = TAALS[rs.taal].beats;
      let lines;
      let label;
      if (rs.ragaEx === 'pakad') { lines = layoutText(raga.pakad, beats, rs.laya); label = R.ex.pakad; }
      else if (RAGA_ALANKARS.includes(rs.ragaEx)) {
        const steps = ALANKARS.find((a) => a.id === rs.ragaEx).steps;
        const asc = pitchClasses(scaleNotes(raga.aaroh));
        const desc = pitchClasses(scaleNotes(raga.avroh));
        lines = layoutNotes(alankarGroups(steps, asc, desc), rs.laya, beats);
        label = R.ex.alankar(R.alankar[rs.ragaEx]);
      } else { lines = layoutText(`${raga.aaroh} ${raga.avroh}`, beats, rs.laya); label = R.ex.aarohAvroh; }
      return {
        title: `${lang === 'en' ? 'Raga ' + raga.name : 'राग ' + raga.dev} · ${label}`, meta: R.inThaat(R.thaats[raga.thaat]),
        taal: rs.taal, lines, pcs: ragaPitchClasses(raga), drone: raga.drone, laya: true,
      };
    }
    if (song) {
      const { lines } = parseNotation(song.notation);
      const pcs = pitchClasses(lines.flatMap((l) => l.cells.flatMap((c) => c.parts.filter((p) => typeof p === 'number'))));
      if (builtin) return { title: bhajanTitle(builtin), meta: R.taals[builtin.taal], taal: builtin.taal, lines, pcs, drone: 'P', laya: false, builtin };
      return { title: song.title || R.untitled, meta: R.taals[song.taal], taal: song.taal, lines, pcs, drone: 'P', laya: false, song };
    }
    return { title: R.free, meta: R.freeMeta, taal: rs.taal, lines: [], pcs: null, drone: 'P', laya: false, free: true };
  }, [rs, raga, song, builtin, R, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = {
    bpm: rs.bpm, loop: rs.loop, taal: piece.taal, notes: rs.notes, tabla: rs.tabla, drone: rs.drone, droneNote: piece.drone,
    saHz: freqFor(0), freqs, freqFor, checking,
  };

  // Restart with the new notation when the exercise changes mid-play; otherwise apply settings live.
  const lastLines = useRef(piece.lines);
  useEffect(() => {
    if (!practice.playing) { lastLines.current = piece.lines; return; }
    if (lastLines.current !== piece.lines) {
      lastLines.current = piece.lines;
      practice.play(piece.lines, opts);
    } else practice.update(opts);
  });

  // Leaving the practice screen on a phone stops the music.
  useEffect(() => { if (phone && !open && practice.playing) practice.stop(); }, [phone, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (startedMic.current) tuner.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCheck = () => {
    const next = !checking;
    setChecking(next);
    if (next && !tuner.listening) { tuner.start(); startedMic.current = true; }
    if (!next && startedMic.current) { tuner.stop(); startedMic.current = false; }
  };
  const togglePlay = () => {
    if (practice.playing) practice.stop();
    else { practice.play(piece.lines, opts); onPractised(); }
  };

  // The note to play now (or first, before playing), lit on the keyboard as a cue.
  const cells = piece.lines.flatMap((l) => l.cells);
  const numsAt = (i) => cells[i]?.parts.filter((p) => typeof p === 'number') ?? [];
  const matra = practice.pos?.matra ?? -1;
  let cueSemi = null;
  for (let i = Math.max(0, matra); i >= 0 && cueSemi == null; i--) if (numsAt(i).length) cueSemi = numsAt(i)[0];
  if (matra < 0) for (let i = 0; i < cells.length && cueSemi == null; i++) if (numsAt(i).length) cueSemi = numsAt(i)[0];
  let nextSemi = null;
  for (let i = Math.max(0, matra) + 1; i < cells.length && nextSemi == null; i++) if (numsAt(i).length) nextSemi = numsAt(i)[0];
  const cueMidi = cueSemi == null ? null : saMidi + cueSemi;
  const scale = piece.pcs ? new Set(piece.pcs.map((p) => ((p % 12) + 12) % 12)) : null;
  const beats = TAALS[piece.taal]?.beats ?? 16;

  const keyByMidi = new Map(keys.map((k) => [k.midi, k]));
  const label = (semi) => (semi == null ? null : { ...swaraLabel(semi, script), k: keyByMidi.get(saMidi + semi) });

  const keyState = (k) => {
    const deg = (((k.midi - saMidi) % 12) + 12) % 12;
    return { tone: harmonium.down.has(k.midi) ? 'down' : k.midi === cueMidi ? 'cue' : scale && !scale.has(deg) ? 'dim' : null };
  };
  const ariaFor = (k, st) => `${k.name}, ${k.swara}${st.tone === 'cue' ? ', ' + U.nextNote : st.tone === 'dim' ? ', ' + U.notInScale : ''}`;
  const keysEl = (
    <Keys keys={keys} keyState={keyState} onPress={harmonium.noteOn} onRelease={harmonium.noteOff} vertical={phone}
      reveal={cueMidi ?? saMidi} ariaFor={ariaFor} minKey={phone ? 44 : 34} className={phone ? 'practice-strip' : 'practice-keys'} />
  );

  const pick = (p) => { setRiyaz(p); if (phone) setOpen(true); };
  const library = <Library phone={phone} rs={rs} songs={songs} script={script} onPick={pick} onTab={(tab) => setRiyaz({ tab })}
    onThaat={(thaat) => setRiyaz({ thaat })} onNew={() => setEditing({ id: '', title: '', taal: 'keherwa', notation: '' })} />;

  const songActions = (
    <>
      {piece.builtin && <button className="btn-secondary sm" type="button" onClick={() => setEditing({ id: '', title: piece.builtin.title, taal: piece.builtin.taal, notation: piece.builtin.notation })}>{R.copyEdit}</button>}
      {piece.song && (
        <>
          <button className="btn-secondary sm" type="button" onClick={() => setEditing(piece.song)}>{R.edit}</button>
          <ConfirmButton className="btn-danger sm" label={R.del} confirmLabel={R.delConfirm} onConfirm={() => { deleteSong(piece.song.id); setRiyaz({ song: 'free' }); }} />
        </>
      )}
    </>
  );

  const ragaChips = rs.tab === 'raga' && (
    <div className="ex-chips" role="group" aria-label={U.exercises}>
      {['aarohAvroh', 'pakad', ...RAGA_ALANKARS].map((e) => (
        <button key={e} type="button" className="chip" aria-pressed={rs.ragaEx === e} onClick={() => setRiyaz({ ragaEx: e })}>
          {e === 'aarohAvroh' ? R.ex.aarohAvroh : e === 'pakad' ? R.ex.pakad : R.alankar[e]}
        </button>
      ))}
    </div>
  );

  const now = label(cueSemi);
  const nxt = label(nextSemi);
  const nowCard = !piece.free && now && (
    <section className="nowcard card" aria-label={U.playNow}>
      <span className={'now-sw' + (script === 'dev' ? '' : ' lat')}>{now.text}{now.octave > 0 && <span className="now-dot">•</span>}</span>
      <span className="now-text">
        <span className="now-k">{U.playNow}</span>
        <span className="now-n">{now.k ? `${now.k.swaraLatin} · ${now.k.name}` : now.text}</span>
        {nxt && <span className="now-next">{U.next} <span className={script === 'dev' ? 'sw' : 'nx-lat'}>{nxt.text}</span>{script === 'dev' ? ' ' + (nxt.k?.swaraLatin ?? '') : ''}{!phone && matra >= 0 ? ' · ' + U.beatOf({ n: (matra % beats) + 1, total: beats }) : ''}</span>}
      </span>
    </section>
  );

  const notation = piece.lines.length > 0
    ? <Notation lines={piece.lines} taal={piece.taal} script={script} matra={matra} results={checking ? practice.results : {}} phone={phone} />
    : <p className="free-hint">{U.freeHint}</p>;

  const toggles = [
    { id: 'notes', name: phone ? U.harmoniumPlays : U.harmoniumShort, sub: U.harmoniumSub, on: rs.notes, flip: () => setRiyaz({ notes: !rs.notes }), hide: piece.free },
    { id: 'drone', name: R.drone, sub: U.tanpuraSub, on: rs.drone, flip: () => setRiyaz({ drone: !rs.drone }) },
    { id: 'tabla', name: R.tabla, sub: U.tablaSub, on: rs.tabla, flip: () => setRiyaz({ tabla: !rs.tabla }) },
    { id: 'mic', name: phone ? U.micCheck : U.micShort, sub: U.micSub, on: checking, flip: toggleCheck, hide: piece.free },
  ].filter((t) => !t.hide);

  const taalSelect = !piece.song && !piece.builtin && (
    <label className="sel-field">{R.taal}
      <select value={rs.taal} onChange={(e) => setRiyaz({ taal: e.target.value })}>
        {TAAL_IDS.map((t) => <option key={t} value={t}>{R.taals[t]} · {TAALS[t].beats}</option>)}
      </select>
    </label>
  );
  const layaSelect = piece.laya && (
    <label className="sel-field">{U.speed}
      <select value={rs.laya} onChange={(e) => setRiyaz({ laya: Number(e.target.value) })}>
        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{U.perBeat(n)}</option>)}
      </select>
    </label>
  );
  const scriptSeg = (
    <div className="seg sm" role="group" aria-label={R.script}>
      {['dev', 'lat'].map((s) => <button key={s} type="button" aria-pressed={script === s} onClick={() => setRiyaz({ script: s })}>{s === 'dev' ? 'सा रे ग' : 'S R G'}</button>)}
    </div>
  );
  const setBpm = (v) => setRiyaz({ bpm: Math.max(30, Math.min(300, Math.round(v) || 80)) });
  const score = checking && practice.score.total > 0 && <span className="score">{R.score(practice.score)}</span>;
  const songEditor = (
    <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? R.edit : R.add} wide>
      {editing && <SongEditor song={editing} onCancel={() => setEditing(null)}
        onSave={(s) => { const id = s.id || 's' + Date.now(); saveSong({ ...s, id }); setRiyaz({ tab: 'bhajan', song: id }); setEditing(null); if (phone) setOpen(true); }} />}
    </Sheet>
  );
  const ragaInfo = rs.tab === 'raga' && <RagaInfo raga={raga} script={script} />;

  if (phone && !open) return <div className="screen riyaz">{library}{songEditor}</div>;

  if (phone) {
    return (
      <div className="practice-phone">
        <header className="pr-head">
          <button type="button" className="ob-back" aria-label={U.backTo} onClick={() => setOpen(false)}><IconBack /></button>
          <div className="pr-title">
            <span className="pr-t">{piece.title}</span>
            <span className="pr-s">{piece.meta} · {R.taals[piece.taal]} · {R.matras(beats)}</span>
          </div>
          <button type="button" className="btn-secondary sm" onClick={() => setSounds(true)}><IconSliders size={16} />{U.sounds}</button>
        </header>
        <section className="pr-strip" aria-label={U.harmonium}>{keysEl}</section>
        <main className="pr-main">
          {ragaChips}
          {nowCard}
          {!piece.free && (
            <div className="beat-line">
              <span>{U.beatOf({ n: matra >= 0 ? (matra % beats) + 1 : 1, total: beats })}</span>
              <span>{U.markHint}</span>
            </div>
          )}
          {notation}
          {score}
          {!piece.free && <p className="hint">{checking ? R.micHint : U.aarohHint}</p>}
          {ragaInfo}
        </main>
        <div className="pr-transport">
          <div className="tempo" role="group" aria-label={R.tempo}>
            <button type="button" aria-label={U.slower} onClick={() => setBpm(rs.bpm - 5)}>−</button>
            <span><span className="tempo-n">{rs.bpm}</span><span className="tempo-u">BPM</span></span>
            <button type="button" aria-label={U.faster} onClick={() => setBpm(rs.bpm + 5)}>+</button>
          </div>
          <button type="button" className="play-big" aria-label={practice.playing ? R.stop : R.play} onClick={togglePlay}>
            {practice.playing ? <IconPause size={24} /> : <IconPlay size={26} />}
          </button>
          <div className="tr-end">
            {!piece.free && <button type="button" className="loop-btn" aria-pressed={rs.loop} onClick={() => setRiyaz({ loop: !rs.loop })}><IconLoop />{U.loop}</button>}
          </div>
        </div>
        {coachShown && !piece.free && !sounds && (
          <div className="coach" role="dialog" aria-label={U.coach}>
            <p><strong>{U.coach}</strong> {U.coachText}</p>
            <div className="coach-foot">
              <button type="button" onClick={onDismissCoach}>{m.ui.common.gotIt}</button>
            </div>
          </div>
        )}
        <Sheet open={sounds} onClose={() => setSounds(false)} title={U.soundsTitle}>
          <ul className="switches">
            {toggles.map((t) => (
              <li key={t.id}>
                <label className="switch-row">
                  <span className="sw-text"><span>{t.name}</span><small>{t.sub}</small></span>
                  <input type="checkbox" className="switch" checked={t.on} onChange={t.flip} />
                </label>
              </li>
            ))}
          </ul>
          <div className="sel-grid">{taalSelect}{layaSelect}</div>
          <div className="sheet-row">{scriptSeg}{songActions}</div>
        </Sheet>
        {songEditor}
      </div>
    );
  }

  return (
    <div className="riyaz-desk">
      {library}
      <main className="practice-desk">
        <header className="pd-head">
          <div className="pd-title">
            <span className="pd-meta">{piece.meta} · {R.taals[piece.taal]} · {R.matras(beats)}</span>
            <h2>{piece.title}</h2>
          </div>
          <div className="pd-toggles" role="group" aria-label={U.sounds}>
            {toggles.map((t) => (
              <button key={t.id} type="button" className="opt-chip" aria-pressed={t.on} onClick={t.flip}><span className="opt-box" aria-hidden="true" />{t.name}</button>
            ))}
          </div>
        </header>
        <div className="pd-sub">{ragaChips}<div className="pd-actions">{songActions}{scriptSeg}</div></div>
        <div className="pd-row">
          {nowCard}
          <section className={'card pd-notation' + (piece.free ? ' free' : '')} aria-label={R.title}>
            {notation}
            {score}
            {checking && <p className="hint">{R.micHint}</p>}
          </section>
        </div>
        <section className="card pd-keys" aria-label={U.harmonium}>
          <div className="pd-keys-head">
            <span className="pd-keys-t">{U.harmonium}</span>
            <span className="lg-item"><span className="lg-cue" />{U.nextNote}</span>
            <span className="lg-item"><span className="lg-dim" />{U.notInScale}</span>
            <span className="pd-keys-hint">{U.keysHint} <kbd>A</kbd>–<kbd>K</kbd> {U.keysHint2}</span>
          </div>
          {keysEl}
        </section>
        <div className="pd-transport">
          <button type="button" className="play-gold" aria-label={practice.playing ? R.stop : R.play} onClick={togglePlay}>
            {practice.playing ? <IconPause /> : <IconPlay size={24} />}
          </button>
          <div className="pd-state">
            <span>{practice.playing ? U.playing : U.ready}</span>
            <small>{rs.loop ? U.loopRound((practice.pos?.pass ?? 0) + 1) : U.once}</small>
          </div>
          <div className="pd-tempo" role="group" aria-label={R.tempo}>
            <button type="button" aria-label={U.slower} onClick={() => setBpm(rs.bpm - 5)}>−</button>
            <span>{rs.bpm} BPM</span>
            <button type="button" aria-label={U.faster} onClick={() => setBpm(rs.bpm + 5)}>+</button>
            <input type="range" min="30" max="300" step="1" value={rs.bpm} aria-label={R.tempo} onChange={(e) => setBpm(e.target.value)} />
          </div>
          {!piece.free && <button type="button" className="pd-loop" aria-pressed={rs.loop} onClick={() => setRiyaz({ loop: !rs.loop })}><IconLoop />{U.loop}</button>}
          {taalSelect}
          {layaSelect}
        </div>
        {ragaInfo}
      </main>
      {songEditor}
    </div>
  );
}

/** The exercise list: Alankars / Ragas / Bhajans, with a featured "start here" pick on phones. */
function Library({ phone, rs, songs, script, onPick, onTab, onThaat, onNew }) {
  const { m, lang } = useI18n();
  const R = m.riyaz;
  const U = m.ui.riyaz;
  const level = (l) => ({ text: U.level[l], cls: 'lvl ' + l });
  const preview = (a) => alankarGroups(a.steps, THAATS[rs.thaat] ?? THAATS.bilawal).slice(0, 3)
    .map((g) => g.map((s) => swaraLabel(s, script).text).join(script === 'dev' ? ' ' : '')).join(script === 'dev' ? ', ' : ' ') + ' …';

  let items;
  let featured;
  let title;
  if (rs.tab === 'alankar') {
    items = ALANKARS.map((a, i) => ({
      key: a.id, n: String(i + 1), title: R.alankar[a.id], sub: preview(a), mono: script === 'lat',
      on: rs.alankar === a.id, pick: () => onPick({ alankar: a.id }), lvl: level(i === 0 ? 'start' : i < 3 ? 'easy' : 'medium'),
    }));
    featured = { kicker: U.featured.alankar, title: `${R.alankarN(1)} · ${R.alankar.straight}`, meta: `${R.thaats[rs.thaat]} · ${R.taals[rs.taal]} · ${U.aboutMin(2)}`, pick: () => onPick({ alankar: 'straight' }) };
    title = U.countAlankars(ALANKARS.length);
  } else if (rs.tab === 'raga') {
    items = RAGAS.map((r) => ({
      key: r.id, n: firstAkshara(r.dev), title: lang === 'en' ? `${r.name} · ${r.dev}` : `${r.dev} · ${r.name}`, sub: `${R.thaats[r.thaat]} · ${R.time[r.time]}`,
      on: rs.raga === r.id, pick: () => onPick({ raga: r.id }), lvl: level(r.id === 'yaman' ? 'start' : EASY_RAGAS.includes(r.id) ? 'easy' : 'medium'),
    }));
    const y = RAGAS.find((r) => r.id === 'yaman') ?? RAGAS[0];
    featured = { kicker: U.featured.raga, title: `${lang === 'en' ? 'Raga ' + y.name : 'राग ' + y.dev} · ${R.ex.aarohAvroh}`, meta: `${R.inThaat(R.thaats[y.thaat])} · ${R.time[y.time]}`, pick: () => onPick({ raga: y.id, ragaEx: 'aarohAvroh' }) };
    title = U.countRagas(RAGAS.length);
  } else {
    items = [
      { key: 'free', n: '∞', title: R.free, sub: R.freeMeta, on: rs.song === 'free' || !rs.song, pick: () => onPick({ song: 'free' }), lvl: level('start') },
      ...BHAJANS.map((b, i) => ({
        key: b.id, n: String(i + 1), title: lang === 'en' ? b.titleLat : b.title, sub: `${R.taals[b.taal]} · ${b.bpm} BPM`,
        on: rs.song === b.id, pick: () => onPick({ song: b.id, bpm: b.bpm }), lvl: level(i < 3 ? 'easy' : 'medium'),
      })),
      ...songs.map((s) => ({ key: s.id, n: '♪', title: s.title || R.untitled, sub: R.taals[s.taal], on: rs.song === s.id, pick: () => onPick({ song: s.id }), lvl: null })),
      { key: 'new', n: '+', title: U.writeOwn, sub: U.writeOwnSub, on: false, pick: onNew, lvl: null },
    ];
    const f = BHAJANS[0];
    featured = { kicker: U.featured.bhajan, title: lang === 'en' ? f.titleLat : f.title, meta: `${R.taals[f.taal]} · ${f.bpm} BPM`, pick: () => onPick({ song: f.id, bpm: f.bpm }) };
    title = U.bhajanList;
  }

  const tabs = (
    <div className="seg full" role="tablist" aria-label={U.kindAria}>
      {['alankar', 'raga', 'bhajan'].map((t) => (
        <button key={t} type="button" role="tab" aria-selected={rs.tab === t} onClick={() => onTab(t)}>{U.kinds[t]}</button>
      ))}
    </div>
  );
  const thaat = rs.tab === 'alankar' && (
    <label className="thaat-sel">{R.thaat}
      <select value={rs.thaat} onChange={(e) => onThaat(e.target.value)}>
        {Object.keys(THAATS).map((t) => <option key={t} value={t}>{R.thaats[t]}</option>)}
      </select>
    </label>
  );

  if (!phone) {
    return (
      <section className="lib-desk" aria-label={R.title}>
        <h1>{R.title}</h1>
        {tabs}
        {thaat}
        <ul className="lib-list">
          {items.map((it) => (
            <li key={it.key}>
              <button type="button" aria-pressed={it.on} onClick={it.pick}>
                <span className="lib-n">{it.n}</span>
                <span className="lib-text"><span className="lib-t">{it.title}</span><span className={'lib-s' + (it.mono ? ' mono' : '')}>{it.sub}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <header className="ph-head col">
        <h1 className="ph-h1">{R.title}</h1>
        <p className="ph-p">{U.intro}</p>
      </header>
      {tabs}
      <button type="button" className="featured" onClick={featured.pick}>
        <span className="ft-text">
          <span className="ft-k">{featured.kicker}</span>
          <span className="ft-t">{featured.title}</span>
          <span className="ft-m">{featured.meta}</span>
        </span>
        <span className="ft-play"><IconPlay /></span>
      </button>
      <div className="lib-head">
        <h2>{title}</h2>
        {thaat}
      </div>
      <ul className="lib-cards">
        {items.map((it) => (
          <li key={it.key}>
            <button type="button" onClick={it.pick}>
              <span className="lib-n">{it.n}</span>
              <span className="lib-text"><span className="lib-t">{it.title}</span><span className="lib-s">{it.sub}</span></span>
              {it.lvl ? <span className={it.lvl.cls}>{it.lvl.text}</span> : <IconChevron />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Notation in taal groups: a vibhag per group with its sam/tali/khali mark, the playhead and mic results. */
function Notation({ lines, taal, script, matra, results, phone }) {
  const box = useRef(null);
  const prev = useRef(null);
  // Follow the playhead, but only while the previous cell was on screen (so browsing is not interrupted).
  useEffect(() => {
    const cellEls = box.current?.querySelectorAll('.nt-cell');
    const el = cellEls?.[matra];
    const last = prev.current == null ? null : cellEls?.[prev.current];
    prev.current = matra >= 0 ? matra : null;
    if (!el) return;
    const sc = phone ? box.current.closest('.pr-main') : null;
    const area = sc ? sc.getBoundingClientRect() : { top: 0, bottom: window.innerHeight - 140 };
    const shown = (r) => r.bottom > area.top && r.top < area.bottom;
    if (last && !shown(last.getBoundingClientRect())) return;
    const r = el.getBoundingClientRect();
    if (r.top >= area.top + 8 && r.bottom <= area.bottom - 8) return;
    const dy = r.top - (area.top + (area.bottom - area.top) / 3);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    (sc ?? window).scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' });
  }, [matra, phone]);

  let i = 0;
  return (
    <div className="notation" role="table" ref={box}>
      {lines.map((line, li) => {
        const groups = [];
        line.cells.forEach((cell, ci) => {
          const idx = i++;
          const mark = taalMark(taal, idx);
          if (mark != null || ci === 0) groups.push({ mark: mark ?? '', cells: [] });
          groups[groups.length - 1].cells.push({ cell, idx });
        });
        return (
          <div className="nt-line" key={li}>
            <div className="nt-groups">
              {groups.map((g, gi) => (
                <div className="nt-group" role="row" key={gi} style={{ flexGrow: g.cells.length }}>
                  <span className="nt-mark">{g.mark}</span>
                  <div className="nt-cells">
                    {g.cells.map(({ cell, idx }) => (
                      <div role="cell" key={idx} className={['nt-cell', idx === matra && 'now', matra >= 0 && idx < matra && 'past', results[idx]].filter(Boolean).join(' ')}>
                        <span className={'nt-parts n' + Math.min(cell.parts.length, 4)}>{cell.parts.map((p, pi) => <Part key={pi} p={p} script={script} />)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {line.lyric && <div className="nt-lyric">{line.lyric}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Part({ p, script }) {
  if (p === 'hold') return <span className="nt-part hold">{script === 'dev' ? 'ऽ' : '-'}</span>;
  if (p === 'rest') return <span className="nt-part rest">·</span>;
  const { text, octave } = swaraLabel(p, script);
  return (
    <span className={'nt-part' + (script === 'dev' ? ' dev' : ' lat')}>
      {octave > 0 && <span className="noct up" aria-hidden="true">{'•'.repeat(octave)}</span>}
      {text}
      {octave < 0 && <span className="noct down" aria-hidden="true">{'•'.repeat(-octave)}</span>}
    </span>
  );
}

function SwaraLine({ text, script }) {
  return (
    <span className="swara-line">
      {parseNotation(text).lines.flatMap((l) => l.cells).map((c, i) => (
        <span key={i} className="sl-word">{c.parts.map((p, pi) => <Part key={pi} p={p} script={script} />)}</span>
      ))}
    </span>
  );
}

function RagaInfo({ raga, script }) {
  const { m } = useI18n();
  const R = m.riyaz;
  const one = (sw) => swaraLabel(scaleNotes(sw)[0], script).text;
  return (
    <section className="card raga-info" aria-label={m.ui.riyaz.aboutRaga}>
      <h3>{m.ui.riyaz.aboutRaga}</h3>
      <dl className="raga-facts">
        <div><dt>{R.info.thaat}</dt><dd>{R.thaats[raga.thaat]}</dd></div>
        <div><dt>{R.info.jati}</dt><dd>{R.jati[raga.jati[0]]}–{R.jati[raga.jati[1]]}</dd></div>
        <div><dt>{R.info.vadi} · {R.info.samvadi}</dt><dd>{one(raga.vadi)} · {one(raga.samvadi)}</dd></div>
        <div><dt>{R.info.time}</dt><dd>{R.time[raga.time]}</dd></div>
      </dl>
      <dl className="raga-lines">
        <div><dt>{R.info.aaroh}</dt><dd><SwaraLine text={raga.aaroh} script={script} /></dd></div>
        <div><dt>{R.info.avroh}</dt><dd><SwaraLine text={raga.avroh} script={script} /></dd></div>
        <div><dt>{R.info.pakad}</dt><dd><SwaraLine text={raga.pakad} script={script} /></dd></div>
      </dl>
      <p className="hint">{R.versionNote}</p>
    </section>
  );
}

function SongEditor({ song, onSave, onCancel }) {
  const { m } = useI18n();
  const R = m.riyaz;
  const [s, setS] = useState(song);
  const { errors } = parseNotation(s.notation);
  return (
    <form className="song-editor" onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
      <label className="field">
        <span>{R.songTitle}</span>
        <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
      </label>
      <label className="field">
        <span>{R.songTaal}</span>
        <select value={s.taal} onChange={(e) => setS({ ...s, taal: e.target.value })}>
          {TAAL_IDS.map((t) => <option key={t} value={t}>{R.taals[t]} · {R.matras(TAALS[t].beats)}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{R.songNotation}</span>
        <textarea className="num" rows="8" spellCheck="false" value={s.notation} placeholder={'S R G - | m P - -\n> …\nP m G R | S - - -'} onChange={(e) => setS({ ...s, notation: e.target.value })} />
        <small>{R.songHelp}</small>
        {errors.length > 0 && <small className="err">{R.songErrors(errors.join(' '))}</small>}
      </label>
      <div className="btn-row">
        <button className="btn-secondary" type="button" onClick={onCancel}>{R.cancel}</button>
        <button className="btn-primary" type="submit">{R.save}</button>
      </div>
    </form>
  );
}
