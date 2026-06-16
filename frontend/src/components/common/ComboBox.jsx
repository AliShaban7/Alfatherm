import { useState, useRef, useEffect } from 'react';

/**
 * Pick-or-add-new combobox. Typing only FILTERS the existing options — it never
 * silently becomes the value. A value is committed only by (a) selecting an
 * existing option or (b) clicking the explicit "➕ «...» əlavə et" row. On blur,
 * uncommitted text is discarded (reverted to the committed value), so a typo
 * can't slip in and fragment the data.
 *
 * Props: value, onChange(value), options:string[], placeholder, allowAdd=true.
 */
const ComboBox = ({ value = '', onChange, options = [], placeholder = '', allowAdd = true }) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const blurTimer = useRef(null);

  // Keep the visible text in sync when the committed value changes externally
  // (e.g. opening the modal to edit a product).
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase().includes(q));
  const exactExists = options.some((o) => o.toLowerCase() === q);
  const showAdd = allowAdd && q.length > 0 && !exactExists;

  const commit = (val) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-control"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so an option's onMouseDown can commit before we revert.
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setQuery(value || ''); // discard uncommitted typing
          }, 150);
        }}
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'white', border: '1px solid var(--gray-200, #e5e7eb)',
            borderRadius: '6px', marginTop: '2px', maxHeight: '220px', overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          {filtered.map((opt) => (
            <div
              key={opt}
              // onMouseDown (not onClick) so it fires before the input's blur.
              onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); commit(opt); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-50, #f9fafb)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              {opt}
            </div>
          ))}
          {showAdd && (
            <div
              onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTimer.current); commit(query.trim()); }}
              style={{
                padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 600,
                color: 'var(--primary, #2563eb)', borderTop: filtered.length ? '1px solid var(--gray-100, #f3f4f6)' : 'none'
              }}
            >
              ➕ «{query.trim()}» əlavə et
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComboBox;
