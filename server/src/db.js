import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS korisnici (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  ime TEXT NOT NULL,
  uloga TEXT NOT NULL DEFAULT 'operater'
);

CREATE TABLE IF NOT EXISTS artikli (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sifra TEXT UNIQUE NOT NULL,
  naziv TEXT NOT NULL,
  jedinica_mere TEXT NOT NULL DEFAULT 'kom',
  pdv_stopa REAL NOT NULL DEFAULT 20,
  nabavna_cena REAL NOT NULL DEFAULT 0,
  prodajna_cena REAL NOT NULL DEFAULT 0,
  min_stanje REAL NOT NULL DEFAULT 0,
  aktivan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partneri (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naziv TEXT NOT NULL,
  pib TEXT,
  maticni_broj TEXT,
  adresa TEXT,
  mesto TEXT,
  telefon TEXT,
  email TEXT,
  tip TEXT NOT NULL DEFAULT 'oba',
  aktivan INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dokumenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broj TEXT UNIQUE NOT NULL,
  tip TEXT NOT NULL CHECK (tip IN ('ulaz', 'izlaz')),
  datum TEXT NOT NULL,
  partner_id INTEGER NOT NULL REFERENCES partneri(id),
  napomena TEXT,
  status TEXT NOT NULL DEFAULT 'nacrt' CHECK (status IN ('nacrt', 'potvrdjen', 'storniran')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES korisnici(id)
);

CREATE TABLE IF NOT EXISTS stavke (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dokument_id INTEGER NOT NULL REFERENCES dokumenti(id) ON DELETE CASCADE,
  artikal_id INTEGER NOT NULL REFERENCES artikli(id),
  kolicina REAL NOT NULL CHECK (kolicina > 0),
  cena REAL NOT NULL DEFAULT 0,
  pdv_stopa REAL NOT NULL DEFAULT 20,
  rabat REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brojaci (
  tip TEXT NOT NULL,
  godina INTEGER NOT NULL,
  poslednji INTEGER NOT NULL,
  PRIMARY KEY (tip, godina)
);
`;

function seed(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM korisnici").get().n;
  if (count > 0) return;

  const insertUser = db.prepare(
    "INSERT INTO korisnici (username, password_hash, ime, uloga) VALUES (?, ?, ?, ?)"
  );
  insertUser.run("admin", bcrypt.hashSync("admin123", 10), "Administrator", "admin");
  insertUser.run("operater", bcrypt.hashSync("operater123", 10), "Skladišni operater", "operater");

  const insertArtikal = db.prepare(`
    INSERT INTO artikli (sifra, naziv, jedinica_mere, pdv_stopa, nabavna_cena, prodajna_cena, min_stanje)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const artikli = [
    ["A-1001", "Brašno T-400 25 kg", "vrec", 10, 1850, 2290, 10],
    ["A-1002", "Ulje suncokretovo 1 L", "kom", 20, 189, 249, 48],
    ["A-1003", "Šećer kristal 1 kg", "kom", 20, 99, 139, 80],
    ["A-1004", "So kuhinjska 1 kg", "kom", 20, 45, 69, 40],
    ["A-1005", "Mleko 2.8% 1 L", "kom", 10, 119, 159, 60],
    ["A-1006", "Kafa mlaveva 200 g", "kom", 20, 289, 379, 24],
    ["A-1007", "Testenina spaghetti 500 g", "kom", 20, 79, 119, 36],
    ["A-1008", "Pirinač dugo zrno 1 kg", "kom", 20, 149, 199, 30],
    ["A-1009", "Deterdžent prašak 3 kg", "kom", 20, 690, 890, 12],
    ["A-1010", "Toalet papir 8/1", "pak", 20, 249, 349, 20],
  ];
  for (const row of artikli) insertArtikal.run(...row);

  const insertPartner = db.prepare(`
    INSERT INTO partneri (naziv, pib, maticni_broj, adresa, mesto, telefon, email, tip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPartner.run(
    "Delta DMD d.o.o.",
    "100000001",
    "07000001",
    "Jurija Gagarina 15",
    "Beograd",
    "011 2000 100",
    "nabavka@deltadmd.rs",
    "dobavljac"
  );
  insertPartner.run(
    "Metro Cash & Carry",
    "100000002",
    "07000002",
    "Autoput 22",
    "Beograd",
    "011 3000 200",
    "veleprodaja@metro.rs",
    "dobavljac"
  );
  insertPartner.run(
    "Pekara Zlatni klas",
    "100000003",
    "07000003",
    "Kralja Petra 8",
    "Novi Sad",
    "021 400 300",
    "pekara@zlatniklas.rs",
    "kupac"
  );
  insertPartner.run(
    "Restoran Kod Mileta",
    "100000004",
    "07000004",
    "Njegoševa 12",
    "Kragujevac",
    "034 500 400",
    "restoran@kodmileta.rs",
    "kupac"
  );
  insertPartner.run(
    "Trgovina Sunce",
    "100000005",
    "07000005",
    "Cara Dušana 44",
    "Niš",
    "018 600 500",
    "sunce@trgovina.rs",
    "oba"
  );

  const insertDok = db.prepare(`
    INSERT INTO dokumenti (broj, tip, datum, partner_id, napomena, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertStavka = db.prepare(`
    INSERT INTO stavke (dokument_id, artikal_id, kolicina, cena, pdv_stopa, rabat)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertBrojac = db.prepare(
    "INSERT INTO brojaci (tip, godina, poslednji) VALUES (?, ?, ?)"
  );

  const year = new Date().getFullYear();
  const ulazId = insertDok.run(
    `ULZ-${year}-0001`,
    "ulaz",
    `${year}-01-15`,
    1,
    "Početna zaliha — veleprodajni ulaz",
    "potvrdjen",
    1
  ).lastInsertRowid;
  insertStavka.run(ulazId, 1, 40, 1850, 10, 0);
  insertStavka.run(ulazId, 2, 120, 189, 20, 0);
  insertStavka.run(ulazId, 3, 200, 99, 20, 0);
  insertStavka.run(ulazId, 4, 80, 45, 20, 0);
  insertStavka.run(ulazId, 5, 150, 119, 10, 0);
  insertStavka.run(ulazId, 6, 60, 289, 20, 0);
  insertStavka.run(ulazId, 7, 90, 79, 20, 0);
  insertStavka.run(ulazId, 8, 70, 149, 20, 0);
  insertStavka.run(ulazId, 9, 24, 690, 20, 0);
  insertStavka.run(ulazId, 10, 40, 249, 20, 0);

  const izlazId = insertDok.run(
    `IZL-${year}-0001`,
    "izlaz",
    `${year}-02-03`,
    3,
    "Isporuka pekari — nedeljna tura",
    "potvrdjen",
    1
  ).lastInsertRowid;
  insertStavka.run(izlazId, 1, 8, 2290, 10, 0);
  insertStavka.run(izlazId, 3, 25, 139, 20, 5);
  insertStavka.run(izlazId, 5, 40, 159, 10, 0);

  insertBrojac.run("ulaz", year, 1);
  insertBrojac.run("izlaz", year, 1);
}

export function createDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seed(db);
  return db;
}

export function nextBroj(db, tip) {
  const year = new Date().getFullYear();
  const prefix = tip === "ulaz" ? "ULZ" : "IZL";
  const row = db.prepare("SELECT poslednji FROM brojaci WHERE tip = ? AND godina = ?").get(tip, year);
  let n;
  if (!row) {
    db.prepare("INSERT INTO brojaci (tip, godina, poslednji) VALUES (?, ?, 1)").run(tip, year);
    n = 1;
  } else {
    n = row.poslednji + 1;
    db.prepare("UPDATE brojaci SET poslednji = ? WHERE tip = ? AND godina = ?").run(n, tip, year);
  }
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

export function stanjeArtikla(db, artikalId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(
      CASE
        WHEN d.tip = 'ulaz' THEN s.kolicina
        WHEN d.tip = 'izlaz' THEN -s.kolicina
        ELSE 0
      END
    ), 0) AS stanje
    FROM stavke s
    JOIN dokumenti d ON d.id = s.dokument_id
    WHERE s.artikal_id = ? AND d.status = 'potvrdjen'
  `).get(artikalId);
  return row.stanje;
}

export function iznosStavke(stavka) {
  const osnovica = stavka.kolicina * stavka.cena * (1 - (stavka.rabat || 0) / 100);
  const pdv = osnovica * ((stavka.pdv_stopa || 0) / 100);
  return { osnovica, pdv, ukupno: osnovica + pdv };
}
