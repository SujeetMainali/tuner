/** Step-by-step tuning instructions for one key, built from its measurements. */
export default function Instructions({ ins }) {
  return (
    <div className={'instructions tone-' + ins.tone} aria-label="Tuning instructions">
      <div className="label">What to do</div>
      <p className="ins-head">{ins.headline}</p>
      {ins.steps.length > 1 ? (
        <ol className="ins-steps">
          {ins.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      ) : (
        <p className="ins-single">{ins.steps[0]}</p>
      )}
      {ins.notes.length > 0 && (
        <ul className="ins-notes">
          {ins.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
