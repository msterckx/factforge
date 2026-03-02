function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = temp;
    }
  }
  return row[b.length];
}

export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const u = normalize(userAnswer);
  const c = normalize(correctAnswer);

  if (!u) return false;

  // 1. Exact match
  if (u === c) return true;

  // 2. Partial / containment match — user answer contains the correct answer or vice-versa
  //    (e.g. "Napoleon" for "Napoleon Bonaparte", or "The Beatles" for "Beatles")
  //    Only applies when the matched portion is at least 4 chars to avoid short-word false positives.
  const shorter = u.length <= c.length ? u : c;
  if (shorter.length >= 4 && (u.includes(c) || c.includes(u))) return true;

  // 3. Fuzzy match — allow ~1 typo per 4 characters, capped at 3 edits
  const maxLen = Math.max(u.length, c.length);
  const tolerance = Math.min(3, Math.max(1, Math.ceil(maxLen / 4)));
  if (maxLen >= 4 && levenshtein(u, c) <= tolerance) return true;

  return false;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
