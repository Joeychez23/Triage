// Resume text extraction for PDF, DOCX, and plain text uploads.
const path = require("path");

class UnsupportedFileError extends Error {}

const TEXT_TYPES = new Set([".txt", ".md", ".markdown", ".text", ".rtf"]);

async function extractResumeText(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const buf = file.buffer;
  const isPdf = ext === ".pdf" || buf.subarray(0, 5).toString("latin1") === "%PDF-";
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // DOCX is a zip archive

  let text;
  if (isPdf) {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: buf });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  } else if (ext === ".docx" || (isZip && ext !== ".doc")) {
    const mammoth = require("mammoth");
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (TEXT_TYPES.has(ext) || (!ext && looksLikeText(buf))) {
    text = buf.toString("utf8");
    if (ext === ".rtf") text = text.replace(/\\[a-z]+-?\d* ?|[{}]/gi, " ");
  } else {
    throw new UnsupportedFileError("That file type isn't supported. Upload a PDF, a Word .docx, or a text file.");
  }
  return tidy(text);
}

function looksLikeText(buf) {
  const sample = buf.subarray(0, 512);
  let bad = 0;
  for (const b of sample) if (b < 9 || (b > 13 && b < 32)) bad += 1;
  return bad / Math.max(1, sample.length) < 0.02;
}

function tidy(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/-- \d+ of \d+ --/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

module.exports = { extractResumeText, UnsupportedFileError };
