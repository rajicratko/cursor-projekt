import fs from "node:fs";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import { createDb } from "./db.js";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "promet.db");
const port = Number(process.env.PORT || 3001);
const clientDist = path.join(__dirname, "..", "..", "client", "dist");

const db = createDb(dbPath);
const app = createApp(db);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Server evidencije prometa sluša na http://localhost:${port}`);
});
