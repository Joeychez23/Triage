// Turns scraped job description HTML (or plain text) into a small list of
// typed blocks: { t: "h" | "p" | "li", x: text }. The client renders blocks as
// React elements, so scraped markup is never injected into the page, and the
// structure lets requirement bullets be pulled out by section.
const { Parser } = require("htmlparser2");

const BLOCK = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "aside",
  "table", "tr", "td", "th", "ul", "ol", "blockquote", "pre", "hr", "dl", "dt", "dd",
]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const BOLD = new Set(["b", "strong"]);
const SKIP = new Set(["script", "style", "noscript", "iframe", "svg", "head", "title", "template"]);
const BULLET = /^[\s ]*(?:[•·▪●◦‣∙○■□➢➤►▶✓✔-]|\*|\d{1,2}[.)])\s+/;

const MAX_BLOCKS = 400;
const MAX_CHARS = 24000;

const clean = (s) =>
  String(s || "")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const visibleLength = (s) => s.replace(/\s/g, "").length;

function looksLikeHeading(text, boldChars) {
  if (text.length > 90 || text.split(" ").length > 12) return false;
  const allBold = boldChars > 0 && boldChars >= visibleLength(text) * 0.9;
  if (allBold) return !/[.!?]$/.test(text) || text.length < 40;
  if (/:$/.test(text) && text.length <= 70) return true;
  // SHOUTED short lines such as "REQUIREMENTS" or "WHAT YOU'LL DO".
  return text.length <= 50 && /[A-Z]/.test(text) && text === text.toUpperCase() && /^[A-Z0-9 &/'’,()-]+:?$/.test(text);
}

function createCollector() {
  const blocks = [];
  let chars = 0;
  const push = (t, x) => {
    if (blocks.length >= MAX_BLOCKS || chars >= MAX_CHARS) return;
    let text = x;
    let type = t;
    if (BULLET.test(text) && type !== "h") {
      text = text.replace(BULLET, "");
      type = "li";
    }
    text = clean(text.replace(/^[:\s]+/, ""));
    if (!text || /^[-–—_=*•.]+$/.test(text)) return;
    if (type === "h") text = text.replace(/\s*:$/, "");
    const prev = blocks[blocks.length - 1];
    if (prev && prev.t === type && prev.x === text) return;
    blocks.push({ t: type, x: text.slice(0, 2000) });
    chars += text.length;
  };
  return { blocks, push };
}

function htmlToBlocks(input) {
  const html = String(input || "");
  if (!/<[a-z][\s\S]*?>/i.test(html)) return textToBlocks(html);

  const { blocks, push } = createCollector();
  let buf = "";
  let boldChars = 0;
  let kind = "p";
  let boldDepth = 0;
  let skipDepth = 0;
  let liDepth = 0;

  const flush = () => {
    const text = clean(buf);
    if (text) push(kind === "p" && looksLikeHeading(text, boldChars) ? "h" : kind, text);
    buf = "";
    boldChars = 0;
    kind = liDepth > 0 ? "li" : "p";
  };

  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIP.has(name)) {
          skipDepth += 1;
          return;
        }
        if (name === "br") {
          if (liDepth > 0) buf += " ";
          else flush();
        } else if (name === "li") {
          flush();
          liDepth += 1;
          kind = "li";
        } else if (HEADINGS.has(name)) {
          flush();
          kind = "h";
        } else if (BLOCK.has(name)) {
          flush();
        } else if (BOLD.has(name)) {
          boldDepth += 1;
        }
      },
      onclosetag(name, isImplied) {
        if (SKIP.has(name)) {
          skipDepth = Math.max(0, skipDepth - 1);
          return;
        }
        if (name === "br" && isImplied) return;
        if (name === "li") {
          flush();
          liDepth = Math.max(0, liDepth - 1);
          kind = liDepth > 0 ? "li" : "p";
        } else if (HEADINGS.has(name)) {
          flush();
          kind = liDepth > 0 ? "li" : "p";
        } else if (BLOCK.has(name)) {
          flush();
        } else if (BOLD.has(name)) {
          boldDepth = Math.max(0, boldDepth - 1);
        }
      },
      ontext(text) {
        if (skipDepth) return;
        buf += text;
        if (boldDepth > 0) boldChars += visibleLength(text);
      },
    },
    { decodeEntities: true, lowerCaseTags: true }
  );
  parser.write(html);
  parser.end();
  flush();
  return blocks;
}

function textToBlocks(text) {
  const { blocks, push } = createCollector();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = clean(raw);
    if (!line) continue;
    if (BULLET.test(raw)) push("li", line);
    else push(looksLikeHeading(line, 0) ? "h" : "p", line);
  }
  return blocks;
}

function blocksToText(blocks, maxChars = MAX_CHARS) {
  const lines = [];
  let used = 0;
  for (const b of blocks || []) {
    const line = b.t === "li" ? `- ${b.x}` : b.t === "h" ? `\n${b.x}:` : b.x;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n").trim();
}

// A short preview for result cards: the first real sentences, skipping
// generic headings and boilerplate openers.
function snippet(blocks, max = 220) {
  const parts = [];
  let len = 0;
  for (const b of blocks || []) {
    if (b.t === "h") continue;
    if (/^(job (title|description|summary)|title|location|company|about the (job|role))\b/i.test(b.x) && b.x.length < 80) continue;
    parts.push(b.x);
    len += b.x.length;
    if (len >= max) break;
  }
  const text = parts.join(" ");
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

module.exports = { htmlToBlocks, textToBlocks, blocksToText, snippet, clean };
