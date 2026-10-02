import { useId, useState } from "react";
import { X } from "lucide-react";

// Tag input: Enter (or a comma, when `splitOnComma`) adds, Backspace on an
// empty field removes the last tag. `suggestions` feed a native datalist.
export default function ChipInput({ value, onChange, placeholder, max = 20, maxLength = 60, suggestions, normalize = (s) => s, label, splitOnComma = true }) {
  const [text, setText] = useState("");
  const listId = useId();
  const add = (raw) => {
    const parts = raw
      .split(splitOnComma ? /[,\n]/ : /\n/)
      .map((s) => normalize(s.trim()))
      .filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!seen.has(p.toLowerCase())) {
        next.push(p.slice(0, maxLength));
        seen.add(p.toLowerCase());
      }
    }
    onChange(next);
    setText("");
  };
  return (
    <div className="chip-input">
      {value.map((v) => (
        <span key={v} className="tag">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={text}
        aria-label={label}
        list={suggestions ? listId : undefined}
        placeholder={value.length >= max ? `Up to ${max}` : placeholder}
        disabled={value.length >= max}
        maxLength={maxLength}
        onChange={(e) => {
          const v = e.target.value;
          if (splitOnComma && v.includes(",")) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
