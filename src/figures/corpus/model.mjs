// The training corpus as one pure model. The build lays out the sorting line from it and the
// page runs the same numbers, so the sheets, the counters and the packed rows can't disagree.
// Every count is illustrative: 20 documents go in, filters drop 8, a sample of 2 kept documents
// trains the tokenizer, and the frozen tokenizer encodes all 12 kept documents into 4 rows.

export const SOURCES = [
  { key: "web", label: "Web crawl" },
  { key: "books", label: "Books" },
  { key: "code", label: "Code" },
  { key: "papers", label: "Papers" },
];

// Why a filter drops a document.
export const REASONS = {
  dup: "near-duplicate",
  quality: "low quality",
  safety: "unsafe",
  mix: "outside the language and domain mix",
};

// The documents in feed order. src indexes SOURCES. drop names the filter that rejects the
// document. tokens is the encoded length of a kept document. sample marks the tokenizer sample.
export const DOCS = [
  { src: 0, tokens: 3 },
  { src: 1, tokens: 9 },
  { src: 0, drop: "dup" },
  { src: 2, tokens: 4, sample: true },
  { src: 3, tokens: 5 },
  { src: 0, drop: "quality" },
  { src: 0, tokens: 3 },
  { src: 2, drop: "dup" },
  { src: 0, drop: "safety" },
  { src: 3, drop: "mix" },
  { src: 1, tokens: 8, sample: true },
  { src: 0, tokens: 2 },
  { src: 2, tokens: 3 },
  { src: 0, drop: "dup" },
  { src: 3, tokens: 4 },
  { src: 0, drop: "quality" },
  { src: 1, drop: "dup" },
  { src: 2, tokens: 4 },
  { src: 3, tokens: 4 },
  { src: 0, tokens: 3 },
];

// Tokens in one training sequence. A boundary token closes every document.
export const SEQ_LEN = 16;
// Cells in the caster's matrix case: the toy vocabulary that the sample teaches.
export const VOCAB = 16;

export const isKept = (doc) => !doc.drop;

// Concatenates the kept documents in order, each followed by one boundary token, and cuts the
// stream into rows of seqLen tokens. Real pipelines carry a short last row into the next batch.
export function pack(docs, seqLen) {
  const cells = [];
  docs.forEach((doc, index) => {
    if (doc.drop) return;
    for (let token = 0; token < doc.tokens; token++) cells.push({ doc: index, boundary: false });
    cells.push({ doc: index, boundary: true });
  });
  const rows = [];
  for (let at = 0; at < cells.length; at += seqLen) rows.push(cells.slice(at, at + seqLen));
  return { cells, rows, full: cells.length % seqLen === 0 };
}

export function summary(docs, seqLen) {
  const kept = docs.filter(isKept);
  const { cells, rows } = pack(docs, seqLen);
  const byReason = Object.fromEntries(Object.keys(REASONS).map((key) => [key, docs.filter((doc) => doc.drop === key).length]));
  const bySource = SOURCES.map((_, src) => docs.filter((doc) => doc.src === src).length);
  const sample = kept.filter((doc) => doc.sample).length;
  return {
    total: docs.length,
    kept: kept.length,
    rejected: docs.length - kept.length,
    byReason,
    bySource,
    sample,
    sampleShare: sample / kept.length,
    tokens: kept.reduce((sum, doc) => sum + doc.tokens, 0),
    cells: cells.length,
    sequences: rows.length,
  };
}
