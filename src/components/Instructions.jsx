import { useI18n } from '../i18n/I18n.jsx';

/** Step-by-step tuning instructions for one key, built from its measurements. */
export default function Instructions({ ins }) {
  const { m } = useI18n();
  return (
    <div className={'instructions tone-' + ins.tone} aria-label={m.badge.aria}>
      <div className="ins-top">
        <span className={'badge tone-' + ins.tone}>{m.badge[ins.tone] ?? m.badge.other}</span>
        <h3 className="ins-head">{ins.headline}</h3>
      </div>
      {ins.steps.length > 1 ? (
        <ol className="ins-steps">
          {ins.steps.map((s, i) => (
            <li key={s}><span className="step-n num" aria-hidden="true">{i + 1}</span><span>{s}</span></li>
          ))}
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
