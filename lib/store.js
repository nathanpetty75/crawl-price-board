const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data", "board.json");
const HISTORY_DIR = path.join(__dirname, "..", "data", "history");

function readBoard() {
  try {
    return JSON.parse(fs.readFileSync(DATA, "utf8"));
  } catch {
    return { generated_at: null, ua: null, rows: [] };
  }
}

function writeBoard(board) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(board, null, 2));
}

function appendHistory(snapshot) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const day = (snapshot.generated_at || new Date().toISOString()).slice(0, 10);
  const file = path.join(HISTORY_DIR, `${day}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
}

function listHistory() {
  try {
    return fs
      .readdirSync(HISTORY_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .map((f) => ({
        date: f.replace(/\.json$/, ""),
        path: `/api/history?date=${f.replace(/\.json$/, "")}`,
      }));
  } catch {
    return [];
  }
}

function readHistoryDay(date) {
  const file = path.join(HISTORY_DIR, `${date}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = { readBoard, writeBoard, appendHistory, listHistory, readHistoryDay, DATA };
