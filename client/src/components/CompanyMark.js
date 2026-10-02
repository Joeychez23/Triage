import { useState } from "react";
import { hue, initials } from "../lib/format";

// Company logo with a colored monogram fallback (broken or missing logos).
export default function CompanyMark({ name, logo, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (logo && !failed) {
    return (
      <span className="company-mark has-logo" style={style}>
        <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    );
  }
  const h = hue(name);
  return (
    <span className="company-mark" style={{ ...style, "--mark-h": h }} aria-hidden>
      {initials(name)}
    </span>
  );
}
