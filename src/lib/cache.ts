/**
 * IndexedDB cache for Meshlink messages.
 * Provides offline access to recent chat history.
 */

const DB_NAME = "meshlink-cache";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const ROOMS_STORE = "rooms";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
        msgStore.createIndex("roomId", "roomId", { unique: false });
        msgStore.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains(ROOMS_STORE)) {
        db.createObjectStore(ROOMS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export interface CachedMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: string;
}

export interface CachedRoom {
  id: string;
  name: string;
  type: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
}

/** Cache messages for a room */
export async function cacheMessages(roomId: string, messages: CachedMessage[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(MESSAGES_STORE, "readwrite");
    const store = tx.objectStore(MESSAGES_STORE);
    for (const msg of messages) {
      store.put(msg);
    }
  } catch { /* IndexedDB not available */ }
}

/** Get cached messages for a room */
export async function getCachedMessages(roomId: string, limit = 100): Promise<CachedMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MESSAGES_STORE, "readonly");
      const store = tx.objectStore(MESSAGES_STORE);
      const index = store.index("roomId");
      const request = index.getAll(roomId);
      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results.slice(-limit));
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Cache room list */
export async function cacheRooms(rooms: CachedRoom[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(ROOMS_STORE, "readwrite");
    const store = tx.objectStore(ROOMS_STORE);
    // Clear old data
    store.clear();
    for (const room of rooms) {
      store.put(room);
    }
  } catch { /* ignore */ }
}

/** Get cached rooms */
export async function getCachedRooms(): Promise<CachedRoom[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(ROOMS_STORE, "readonly");
      const store = tx.objectStore(ROOMS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Clear all cached data */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([MESSAGES_STORE, ROOMS_STORE], "readwrite");
    tx.objectStore(MESSAGES_STORE).clear();
    tx.objectStore(ROOMS_STORE).clear();
  } catch { /* ignore */ }
}

/** Get cache size estimate */
export async function getCacheSize(): Promise<string> {
  try {
    const estimate = await navigator.storage.estimate();
    const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024);
    return `${usedMB} MB`;
  } catch {
    return "unknown";
  }
}
