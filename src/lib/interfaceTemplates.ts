import type { LayerRow } from "./layerForm.ts";
import type { ElectrodeMode } from "../physics/types.ts";

export interface InterfaceTemplate {
  id: string;
  source: "built-in" | "user";
  name: string;
  electrodeMode?: ElectrodeMode;
  rows: LayerRow[];
}

const DB_NAME = "band-alignment-sim-interfaces";
const DB_VERSION = 1;
const STORE_NAME = "interface-templates";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
  fallback: T,
): Promise<T> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(fallback);
  }
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = action(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
        };
      }),
  );
}

function uniqueUserInterfaceId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `interface-${Date.now()}-${random}`;
}

function cloneRows(rows: LayerRow[]): LayerRow[] {
  return rows.map((row) => ({ ...row }));
}

export function createUserInterfaceTemplate(
  rows: LayerRow[],
  electrodeMode: ElectrodeMode,
  name = "New interface",
): InterfaceTemplate {
  return {
    id: uniqueUserInterfaceId(),
    source: "user",
    name,
    electrodeMode,
    rows: cloneRows(rows),
  };
}

export function interfaceElectrodeMode(template: InterfaceTemplate): ElectrodeMode {
  return template.electrodeMode ?? "shorted";
}

export function instantiateInterfaceRows(template: InterfaceTemplate): LayerRow[] {
  return template.rows.map((row, index) => ({
    ...row,
    id: `${template.id}-${index}-${Date.now()}`,
  }));
}

export function listUserInterfaceTemplates(): Promise<InterfaceTemplate[]> {
  return runStore<InterfaceTemplate[]>("readonly", (store) => store.getAll(), []);
}

export function saveUserInterfaceTemplate(
  template: InterfaceTemplate,
): Promise<InterfaceTemplate> {
  return runStore<IDBValidKey>("readwrite", (store) => store.put(template), template.id).then(
    () => template,
  );
}

export function deleteUserInterfaceTemplate(id: string): Promise<void> {
  return runStore<undefined>("readwrite", (store) => store.delete(id), undefined).then(
    () => undefined,
  );
}
