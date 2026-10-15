import { useI18n } from '../i18n/I18n.jsx';

/** The step-by-step tuning guide; its text lives in src/i18n/messages.js. */
export default function Guide() {
  const { m } = useI18n();
  return (
    <section className="card guide" id="guide" aria-label={m.guide.title}>
      <div className="card-head">
        <h2>{m.guide.title}</h2>
      </div>
      <ol className="guide-steps">
        {m.guide.steps.map((s, i) => (
          <li key={s.title}>
            <span className="guide-n num" aria-hidden="true">{i + 1}</span>
            <div>
              <div className="guide-title">{s.title}</div>
              <div className="guide-text">{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
