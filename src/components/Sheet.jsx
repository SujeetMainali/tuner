import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18n.jsx';

/**
 * A modal panel: a bottom sheet on phones, a centred card on desktops. Built on <dialog>, so Escape
 * and the backdrop close it and focus stays inside while it is open.
 */
export default function Sheet({ open, onClose, title, children, wide = false, footer = null }) {
  const { m } = useI18n();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={'sheet' + (wide ? ' wide' : '')} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}>
      <div className="sheet-in">
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="sheet-done" onClick={onClose}>{m.ui.common.done}</button>
        </div>
        <div className="sheet-body">{open && children}</div>
        {footer}
      </div>
    </dialog>
  );
}
