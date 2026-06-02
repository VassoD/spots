"use client";

import type { ProcessResult } from "./types";

// Local-only persistence: the processed atlas is kept in the browser via
// IndexedDB so returning users skip re-uploading. Nothing leaves the device.

const DB_NAME = "spots";
const STORE = "kv";
const KEY = "lastResult";
const VERSION = 1;

export interface StoredResult {
  result: ProcessResult;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveResult(result: ProcessResult): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const payload: StoredResult = { result, savedAt: Date.now() };
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Persistence is best-effort; never block the app on storage failure.
  }
}

export async function loadResult(): Promise<StoredResult | null> {
  try {
    const db = await openDb();
    const stored = await new Promise<StoredResult | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as StoredResult | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return stored;
  } catch {
    return null;
  }
}

export async function clearResult(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // ignore
  }
}
