// A hairline between items in a metadata line, used instead of a "·" glyph.
// Screen readers hear a comma.
export default function Sep() {
  return (
    <span className="sep">
      <span className="sr-only">, </span>
    </span>
  );
}
