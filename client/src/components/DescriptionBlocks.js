// Renders the server's description blocks ({t: "h"|"p"|"li", x}) as React
// elements. Scraped HTML is never injected into the page.
export default function DescriptionBlocks({ blocks, highlight = [] }) {
  if (!blocks?.length) return <p className="muted">No description was provided for this posting.</p>;
  const groups = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (b.t === "li" && last?.t === "ul") last.items.push(b.x);
    else if (b.t === "li") groups.push({ t: "ul", items: [b.x] });
    else groups.push(b);
  }
  const terms = highlight.filter(Boolean);
  return (
    <div className="description">
      {groups.map((g, i) => {
        if (g.t === "h") return <h4 key={i}>{g.x}</h4>;
        if (g.t === "ul")
          return (
            <ul key={i}>
              {g.items.map((x, j) => (
                <li key={j}>{mark(x, terms)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{mark(g.x, terms)}</p>;
      })}
    </div>
  );
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Highlights the user's skills inside the text.
function mark(text, terms) {
  if (!terms.length) return text;
  const re = new RegExp(`(?<![\\w])(${terms.map(esc).join("|")})(?![\\w])`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p));
}
