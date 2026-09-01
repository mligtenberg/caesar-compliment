// config/local.json allows // and /* */ comments (the backend's JSON config
// provider already tolerates these; JSON.parse doesn't, so strip them here).
// Comment-like sequences inside string values (e.g. "http://...") are left alone.
export function stripJsonComments(text) {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        result += c;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += c;
      if (c === '\\') {
        result += next;
        i++;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      result += c;
    } else if (c === '/' && next === '/') {
      inLineComment = true;
      i++;
    } else if (c === '/' && next === '*') {
      inBlockComment = true;
      i++;
    } else {
      result += c;
    }
  }

  return result;
}
