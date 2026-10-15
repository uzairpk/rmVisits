const DB_NAME = "rmVisits";
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("territory")) {
        db.createObjectStore("territory", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("rmMaster")) {
        db.createObjectStore("rmMaster", { keyPath: "month" });
      }
      if (!db.objectStoreNames.contains("visitLog")) {
        db.createObjectStore("visitLog", { keyPath: "month" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function saveTerritory(rows) {
  const db = await openDb();
  const tx = db.transaction("territory", "readwrite");
  tx.objectStore("territory").put({
    id: "current",
    rows: rows,
    savedAt: new Date().toISOString()
  });
  await txDone(tx);
  db.close();
}

async function getTerritory() {
  const db = await openDb();
  const tx = db.transaction("territory", "readonly");
  const rec = await new Promise((resolve, reject) => {
    const req = tx.objectStore("territory").get("current");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rec;
}

async function saveRmMonth(month, rows) {
  const db = await openDb();
  const tx = db.transaction("rmMaster", "readwrite");
  tx.objectStore("rmMaster").put({
    month: String(month),
    rows: rows,
    savedAt: new Date().toISOString()
  });
  await txDone(tx);
  db.close();
}

async function getAllRmMaster() {
  const db = await openDb();
  const tx = db.transaction("rmMaster", "readonly");
  const list = await new Promise((resolve, reject) => {
    const req = tx.objectStore("rmMaster").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return list.sort((a, b) => Number(a.month) - Number(b.month));
}

async function getRmMonth(month) {
  const db = await openDb();
  const tx = db.transaction("rmMaster", "readonly");
  const rec = await new Promise((resolve, reject) => {
    const req = tx.objectStore("rmMaster").get(String(month));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rec;
}

async function saveVisitMonth(month, rows) {
  const db = await openDb();
  const tx = db.transaction("visitLog", "readwrite");
  tx.objectStore("visitLog").put({
    month: String(month),
    rows: rows,
    savedAt: new Date().toISOString()
  });
  await txDone(tx);
  db.close();
}

async function getVisitMonth(month) {
  const db = await openDb();
  const tx = db.transaction("visitLog", "readonly");
  const rec = await new Promise((resolve, reject) => {
    const req = tx.objectStore("visitLog").get(String(month));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rec;
}

async function getAllVisitLogs() {
  const db = await openDb();
  if (!db.objectStoreNames.contains("visitLog")) {
    db.close();
    return [];
  }
  const tx = db.transaction("visitLog", "readonly");
  const list = await new Promise((resolve, reject) => {
    const req = tx.objectStore("visitLog").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return list.sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

async function clearAllData() {
  const db = await openDb();
  const names = ["territory", "rmMaster"];
  if (db.objectStoreNames.contains("visitLog")) names.push("visitLog");
  const tx = db.transaction(names, "readwrite");
  names.forEach((n) => tx.objectStore(n).clear());
  await txDone(tx);
  db.close();
}
