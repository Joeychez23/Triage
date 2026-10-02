import { useState } from "react";
import { Plus, X } from "lucide-react";

// Editable list of short plain-English statements (dealbreakers, must-haves)
// with one-click examples.
export default function ListEditor({ items, onChange, examples = [], placeholder, max = 10, tone = "neutral" }) {
  const [text, setText] = useState("");
  const add = (value) => {
    const v = value.trim().slice(0, 160);
    if (!v || items.length >= max || items.some((i) => i.toLowerCase() === v.toLowerCase())) return;
    onChange([...items, v]);
    setText("");
  };
  const unused = examples.filter((e) => !items.some((i) => i.toLowerCase() === e.toLowerCase()));
  return (
    <div className={`list-editor tone-${tone}`}>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <button type="button" className="icon-btn" onClick={() => onChange(items.filter((i) => i !== item))} aria-label={`Remove ${item}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="list-editor-add"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={items.length >= max ? `Up to ${max}` : placeholder} maxLength={160} disabled={items.length >= max} />
        <button type="submit" className="btn btn-sm" disabled={!text.trim() || items.length >= max}>
          Add
        </button>
      </form>
      {unused.length > 0 && items.length < max && (
        <div className="examples">
          {unused.slice(0, 6).map((e) => (
            <button key={e} type="button" className="chip chip-neutral chip-btn" onClick={() => add(e)}>
              <Plus size={12} aria-hidden /> {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
