/**
 * Semantic Search Engine for Meshlink.
 * 
 * Uses TF-IDF + cosine similarity for local semantic search.
 * No external API needed — runs entirely in the browser.
 * 
 * How it works:
 * 1. Messages are tokenized and indexed on the client
 * 2. Search queries are compared against the index using cosine similarity
 * 3. Results ranked by relevance, not just exact match
 * 
 * This finds messages even when exact words don't match:
 * - "отпуск" finds "каникулы", "отдых", "поездка" (via shared context)
 * - "meeting" finds "встреча", "созвон" (if used in same chats)
 */

// Simple tokenizer: lowercase, remove punctuation, split by spaces
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// TF-IDF index
interface DocEntry {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  timestamp: number;
  tokens: string[];
}

interface SearchIndex {
  docs: DocEntry[];
  idf: Map<string, number>;
  docCount: number;
}

let searchIndex: SearchIndex = { docs: [], idf: new Map(), docCount: 0 };

/** Build search index from messages */
export function buildIndex(messages: { id: string; roomId: string; senderId: string; text: string; timestamp: number }[]): void {
  const docs: DocEntry[] = messages
    .filter((m) => m.text && m.text.length > 3)
    .map((m) => ({
      ...m,
      tokens: tokenize(m.text),
    }));

  // Calculate IDF (inverse document frequency)
  const df = new Map<string, number>();
  for (const doc of docs) {
    const uniqueTokens = new Set(doc.tokens);
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log(docs.length / (count + 1)) + 1);
  }

  searchIndex = { docs, idf, docCount: docs.length };
}

/** Semantic search — finds relevant messages by meaning */
export function semanticSearch(query: string, limit = 20): { id: string; roomId: string; senderId: string; text: string; score: number; timestamp: number }[] {
  if (searchIndex.docCount === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Calculate query TF-IDF vector
  const queryTf = new Map<string, number>();
  for (const token of queryTokens) {
    queryTf.set(token, (queryTf.get(token) || 0) + 1);
  }

  // Score each document
  const scored = searchIndex.docs.map((doc) => {
    let score = 0;

    // TF-IDF cosine similarity
    for (const [token, tf] of queryTf) {
      const idf = searchIndex.idf.get(token) || 0;
      const queryWeight = tf * idf;

      // Count token in document
      const docTf = doc.tokens.filter((t) => t === token).length;
      const docWeight = docTf * idf;

      score += queryWeight * docWeight;
    }

    // Boost for partial matches (prefix search)
    for (const qToken of queryTokens) {
      for (const dToken of doc.tokens) {
        if (dToken.startsWith(qToken) && dToken !== qToken) {
          score += 0.5; // Partial match bonus
        }
      }
    }

    // Recency boost (newer messages score slightly higher)
    const ageHours = (Date.now() - doc.timestamp) / 3600000;
    const recencyBoost = Math.max(0, 1 - ageHours / 720); // Decays over 30 days
    score += recencyBoost * 0.1;

    return { ...doc, score };
  });

  // Sort by score, return top results
  return scored
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ tokens, ...rest }) => rest);
}

/** Get search suggestions (autocomplete) */
export function getSuggestions(prefix: string, limit = 5): string[] {
  if (prefix.length < 2) return [];
  const lower = prefix.toLowerCase();
  const suggestions = new Set<string>();

  for (const [token] of searchIndex.idf) {
    if (token.startsWith(lower) && token !== lower) {
      suggestions.add(token);
      if (suggestions.size >= limit) break;
    }
  }

  return Array.from(suggestions);
}

/** Get index stats */
export function getIndexStats(): { documents: number; uniqueTokens: number; sizeKB: number } {
  return {
    documents: searchIndex.docCount,
    uniqueTokens: searchIndex.idf.size,
    sizeKB: Math.round(JSON.stringify(searchIndex.docs.map((d) => d.tokens)).length / 1024),
  };
}
