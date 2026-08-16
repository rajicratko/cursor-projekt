import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nextBroj, stanjeArtikla, iznosStavke } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "promet-lokalni-kljuc";

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(httpError(401, "Prijava je obavezna."));
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(httpError(401, "Sesija je istekla. Prijavite se ponovo."));
  }
}

function validateStavke(stavke) {
  if (!Array.isArray(stavke) || stavke.length === 0) {
    throw httpError(400, "Dokument mora imati bar jednu stavku.");
  }
  return stavke.map((s) => {
    const artikal_id = Number(s.artikal_id);
    const kolicina = Number(s.kolicina);
    const cena = Number(s.cena ?? 0);
    const pdv_stopa = Number(s.pdv_stopa ?? 20);
    const rabat = Number(s.rabat ?? 0);
    if (!artikal_id) throw httpError(400, "Stavka mora imati artikal.");
    if (!(kolicina > 0)) throw httpError(400, "Količina mora biti veća od nule.");
    if (cena < 0 || rabat < 0 || rabat > 100) throw httpError(400, "Neispravna cena ili rabat.");
    return { artikal_id, kolicina, cena, pdv_stopa, rabat };
  });
}

function dokumentSaStavkama(db, id) {
  const dokument = db.prepare(`
    SELECT d.*, p.naziv AS partner_naziv, p.pib AS partner_pib, p.mesto AS partner_mesto
    FROM dokumenti d
    JOIN partneri p ON p.id = d.partner_id
    WHERE d.id = ?
  `).get(id);
  if (!dokument) return null;
  const stavke = db.prepare(`
    SELECT s.*, a.sifra, a.naziv, a.jedinica_mere
    FROM stavke s
    JOIN artikli a ON a.id = s.artikal_id
    WHERE s.dokument_id = ?
    ORDER BY s.id
  `).all(id);
  let osnovica = 0;
  let pdv = 0;
  const stavkeSaIznosom = stavke.map((s) => {
    const iznos = iznosStavke(s);
    osnovica += iznos.osnovica;
    pdv += iznos.pdv;
    return { ...s, ...iznos };
  });
  return { ...dokument, stavke: stavkeSaIznosom, osnovica, pdv, ukupno: osnovica + pdv };
}

function proveriZalihe(db, stavke, ignoreDokumentId = null) {
  const grouped = new Map();
  for (const s of stavke) {
    grouped.set(s.artikal_id, (grouped.get(s.artikal_id) || 0) + s.kolicina);
  }
  for (const [artikalId, kolicina] of grouped) {
    let raspolozivo = stanjeArtikla(db, artikalId);
    if (ignoreDokumentId) {
      const prethodni = db.prepare(`
        SELECT COALESCE(SUM(s.kolicina), 0) AS k
        FROM stavke s
        JOIN dokumenti d ON d.id = s.dokument_id
        WHERE d.id = ? AND d.tip = 'izlaz' AND d.status = 'potvrdjen' AND s.artikal_id = ?
      `).get(ignoreDokumentId, artikalId);
      raspolozivo += prethodni.k;
    }
    if (kolicina > raspolozivo + 1e-9) {
      const artikal = db.prepare("SELECT sifra, naziv FROM artikli WHERE id = ?").get(artikalId);
      throw httpError(
        400,
        `Nema dovoljno zaliha za ${artikal?.sifra || artikalId} ${artikal?.naziv || ""}. Raspoloživo: ${raspolozivo}, traženo: ${kolicina}.`
      );
    }
  }
}

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, naziv: "Evidencija prometa robe" });
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const user = db.prepare("SELECT * FROM korisnici WHERE username = ?").get(String(username || "").trim());
      if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash)) {
        throw httpError(401, "Pogrešno korisničko ime ili lozinka.");
      }
      const token = jwt.sign(
        { id: user.id, username: user.username, ime: user.ime, uloga: user.uloga },
        JWT_SECRET,
        { expiresIn: "12h" }
      );
      res.json({ token, user: { id: user.id, username: user.username, ime: user.ime, uloga: user.uloga } });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api", requireAuth);

  app.get("/api/auth/me", (req, res) => {
    res.json(req.user);
  });

  app.get("/api/pregled", (_req, res) => {
    const artikli = db.prepare("SELECT COUNT(*) AS n FROM artikli WHERE aktivan = 1").get().n;
    const partneri = db.prepare("SELECT COUNT(*) AS n FROM partneri WHERE aktivan = 1").get().n;
    const dokumenti = db.prepare("SELECT COUNT(*) AS n FROM dokumenti").get().n;
    const nacrti = db.prepare("SELECT COUNT(*) AS n FROM dokumenti WHERE status = 'nacrt'").get().n;
    const ispodMin = db.prepare(`
      SELECT COUNT(*) AS n FROM (
        SELECT a.id,
          COALESCE(SUM(CASE WHEN d.tip = 'ulaz' THEN s.kolicina WHEN d.tip = 'izlaz' THEN -s.kolicina ELSE 0 END), 0) AS stanje
        FROM artikli a
        LEFT JOIN stavke s ON s.artikal_id = a.id
        LEFT JOIN dokumenti d ON d.id = s.dokument_id AND d.status = 'potvrdjen'
        WHERE a.aktivan = 1
        GROUP BY a.id
        HAVING stanje < a.min_stanje
      )
    `).get().n;
    const vrednost = db.prepare(`
      SELECT COALESCE(SUM(stanje * nabavna_cena), 0) AS v FROM (
        SELECT a.nabavna_cena,
          COALESCE(SUM(CASE WHEN d.tip = 'ulaz' THEN s.kolicina WHEN d.tip = 'izlaz' THEN -s.kolicina ELSE 0 END), 0) AS stanje
        FROM artikli a
        LEFT JOIN stavke s ON s.artikal_id = a.id
        LEFT JOIN dokumenti d ON d.id = s.dokument_id AND d.status = 'potvrdjen'
        WHERE a.aktivan = 1
        GROUP BY a.id
      )
    `).get().v;
    const poslednji = db.prepare(`
      SELECT d.id, d.broj, d.tip, d.datum, d.status, p.naziv AS partner_naziv
      FROM dokumenti d
      JOIN partneri p ON p.id = d.partner_id
      ORDER BY d.id DESC
      LIMIT 8
    `).all();
    res.json({ artikli, partneri, dokumenti, nacrti, ispodMin, vrednost, poslednji });
  });

  app.get("/api/artikli", (req, res) => {
    const q = `%${String(req.query.q || "").trim()}%`;
    const rows = db.prepare(`
      SELECT a.*,
        COALESCE(SUM(CASE WHEN d.tip = 'ulaz' THEN s.kolicina WHEN d.tip = 'izlaz' THEN -s.kolicina ELSE 0 END), 0) AS stanje
      FROM artikli a
      LEFT JOIN stavke s ON s.artikal_id = a.id
      LEFT JOIN dokumenti d ON d.id = s.dokument_id AND d.status = 'potvrdjen'
      WHERE a.aktivan = 1 AND (a.sifra LIKE ? OR a.naziv LIKE ?)
      GROUP BY a.id
      ORDER BY a.sifra
    `).all(q, q);
    res.json(rows);
  });

  app.get("/api/artikli/:id", (req, res, next) => {
    const row = db.prepare("SELECT * FROM artikli WHERE id = ?").get(Number(req.params.id));
    if (!row) return next(httpError(404, "Artikal nije pronađen."));
    res.json({ ...row, stanje: stanjeArtikla(db, row.id) });
  });

  app.post("/api/artikli", (req, res, next) => {
    try {
      const { sifra, naziv, jedinica_mere, pdv_stopa, nabavna_cena, prodajna_cena, min_stanje } = req.body || {};
      if (!String(sifra || "").trim() || !String(naziv || "").trim()) {
        throw httpError(400, "Šifra i naziv su obavezni.");
      }
      const result = db.prepare(`
        INSERT INTO artikli (sifra, naziv, jedinica_mere, pdv_stopa, nabavna_cena, prodajna_cena, min_stanje)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(sifra).trim(),
        String(naziv).trim(),
        String(jedinica_mere || "kom").trim(),
        Number(pdv_stopa ?? 20),
        Number(nabavna_cena ?? 0),
        Number(prodajna_cena ?? 0),
        Number(min_stanje ?? 0)
      );
      res.status(201).json(db.prepare("SELECT * FROM artikli WHERE id = ?").get(result.lastInsertRowid));
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) return next(httpError(409, "Šifra artikla već postoji."));
      next(err);
    }
  });

  app.put("/api/artikli/:id", (req, res, next) => {
    try {
      const existing = db.prepare("SELECT * FROM artikli WHERE id = ?").get(Number(req.params.id));
      if (!existing) throw httpError(404, "Artikal nije pronađen.");
      const { sifra, naziv, jedinica_mere, pdv_stopa, nabavna_cena, prodajna_cena, min_stanje, aktivan } = req.body || {};
      db.prepare(`
        UPDATE artikli SET sifra = ?, naziv = ?, jedinica_mere = ?, pdv_stopa = ?,
          nabavna_cena = ?, prodajna_cena = ?, min_stanje = ?, aktivan = ?
        WHERE id = ?
      `).run(
        String(sifra ?? existing.sifra).trim(),
        String(naziv ?? existing.naziv).trim(),
        String(jedinica_mere ?? existing.jedinica_mere).trim(),
        Number(pdv_stopa ?? existing.pdv_stopa),
        Number(nabavna_cena ?? existing.nabavna_cena),
        Number(prodajna_cena ?? existing.prodajna_cena),
        Number(min_stanje ?? existing.min_stanje),
        aktivan === undefined ? existing.aktivan : Number(aktivan),
        existing.id
      );
      res.json(db.prepare("SELECT * FROM artikli WHERE id = ?").get(existing.id));
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) return next(httpError(409, "Šifra artikla već postoji."));
      next(err);
    }
  });

  app.delete("/api/artikli/:id", (req, res, next) => {
    const existing = db.prepare("SELECT id FROM artikli WHERE id = ?").get(Number(req.params.id));
    if (!existing) return next(httpError(404, "Artikal nije pronađen."));
    db.prepare("UPDATE artikli SET aktivan = 0 WHERE id = ?").run(existing.id);
    res.json({ ok: true });
  });

  app.get("/api/partneri", (req, res) => {
    const q = `%${String(req.query.q || "").trim()}%`;
    const tip = String(req.query.tip || "").trim();
    const rows = tip
      ? db.prepare(`
          SELECT * FROM partneri
          WHERE aktivan = 1 AND (tip = ? OR tip = 'oba') AND (naziv LIKE ? OR IFNULL(pib,'') LIKE ?)
          ORDER BY naziv
        `).all(tip, q, q)
      : db.prepare(`
          SELECT * FROM partneri
          WHERE aktivan = 1 AND (naziv LIKE ? OR IFNULL(pib,'') LIKE ?)
          ORDER BY naziv
        `).all(q, q);
    res.json(rows);
  });

  app.get("/api/partneri/:id", (req, res, next) => {
    const row = db.prepare("SELECT * FROM partneri WHERE id = ?").get(Number(req.params.id));
    if (!row) return next(httpError(404, "Partner nije pronađen."));
    res.json(row);
  });

  app.post("/api/partneri", (req, res, next) => {
    try {
      const { naziv, pib, maticni_broj, adresa, mesto, telefon, email, tip } = req.body || {};
      if (!String(naziv || "").trim()) throw httpError(400, "Naziv partnera je obavezan.");
      const result = db.prepare(`
        INSERT INTO partneri (naziv, pib, maticni_broj, adresa, mesto, telefon, email, tip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(naziv).trim(),
        String(pib || "").trim() || null,
        String(maticni_broj || "").trim() || null,
        String(adresa || "").trim() || null,
        String(mesto || "").trim() || null,
        String(telefon || "").trim() || null,
        String(email || "").trim() || null,
        ["dobavljac", "kupac", "oba"].includes(tip) ? tip : "oba"
      );
      res.status(201).json(db.prepare("SELECT * FROM partneri WHERE id = ?").get(result.lastInsertRowid));
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/partneri/:id", (req, res, next) => {
    try {
      const existing = db.prepare("SELECT * FROM partneri WHERE id = ?").get(Number(req.params.id));
      if (!existing) throw httpError(404, "Partner nije pronađen.");
      const body = req.body || {};
      db.prepare(`
        UPDATE partneri SET naziv = ?, pib = ?, maticni_broj = ?, adresa = ?, mesto = ?,
          telefon = ?, email = ?, tip = ?, aktivan = ?
        WHERE id = ?
      `).run(
        String(body.naziv ?? existing.naziv).trim(),
        body.pib === undefined ? existing.pib : String(body.pib || "").trim() || null,
        body.maticni_broj === undefined ? existing.maticni_broj : String(body.maticni_broj || "").trim() || null,
        body.adresa === undefined ? existing.adresa : String(body.adresa || "").trim() || null,
        body.mesto === undefined ? existing.mesto : String(body.mesto || "").trim() || null,
        body.telefon === undefined ? existing.telefon : String(body.telefon || "").trim() || null,
        body.email === undefined ? existing.email : String(body.email || "").trim() || null,
        ["dobavljac", "kupac", "oba"].includes(body.tip) ? body.tip : existing.tip,
        body.aktivan === undefined ? existing.aktivan : Number(body.aktivan),
        existing.id
      );
      res.json(db.prepare("SELECT * FROM partneri WHERE id = ?").get(existing.id));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/partneri/:id", (req, res, next) => {
    const existing = db.prepare("SELECT id FROM partneri WHERE id = ?").get(Number(req.params.id));
    if (!existing) return next(httpError(404, "Partner nije pronađen."));
    db.prepare("UPDATE partneri SET aktivan = 0 WHERE id = ?").run(existing.id);
    res.json({ ok: true });
  });

  app.get("/api/dokumenti", (req, res) => {
    const tip = String(req.query.tip || "").trim();
    const status = String(req.query.status || "").trim();
    const od = String(req.query.od || "").trim();
    const doo = String(req.query.do || "").trim();
    const q = `%${String(req.query.q || "").trim()}%`;
    const rows = db.prepare(`
      SELECT d.*, p.naziv AS partner_naziv,
        (SELECT COUNT(*) FROM stavke s WHERE s.dokument_id = d.id) AS broj_stavki
      FROM dokumenti d
      JOIN partneri p ON p.id = d.partner_id
      WHERE (? = '' OR d.tip = ?)
        AND (? = '' OR d.status = ?)
        AND (? = '' OR d.datum >= ?)
        AND (? = '' OR d.datum <= ?)
        AND (d.broj LIKE ? OR p.naziv LIKE ?)
      ORDER BY d.datum DESC, d.id DESC
    `).all(tip, tip, status, status, od, od, doo, doo, q, q);
    res.json(rows);
  });

  app.get("/api/dokumenti/:id", (req, res, next) => {
    const dok = dokumentSaStavkama(db, Number(req.params.id));
    if (!dok) return next(httpError(404, "Dokument nije pronađen."));
    res.json(dok);
  });

  app.post("/api/dokumenti", (req, res, next) => {
    try {
      const { tip, datum, partner_id, napomena, stavke, potvrdi } = req.body || {};
      if (!["ulaz", "izlaz"].includes(tip)) throw httpError(400, "Tip dokumenta mora biti ulaz ili izlaz.");
      if (!datum) throw httpError(400, "Datum je obavezan.");
      const partner = db.prepare("SELECT * FROM partneri WHERE id = ? AND aktivan = 1").get(Number(partner_id));
      if (!partner) throw httpError(400, "Partner nije pronađen.");
      const clean = validateStavke(stavke);
      for (const s of clean) {
        const a = db.prepare("SELECT id FROM artikli WHERE id = ? AND aktivan = 1").get(s.artikal_id);
        if (!a) throw httpError(400, "Jedan od artikala nije aktivan.");
      }
      const tx = db.transaction(() => {
        if (potvrdi && tip === "izlaz") proveriZalihe(db, clean);
        const broj = nextBroj(db, tip);
        const result = db.prepare(`
          INSERT INTO dokumenti (broj, tip, datum, partner_id, napomena, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          broj,
          tip,
          datum,
          partner.id,
          String(napomena || "").trim() || null,
          potvrdi ? "potvrdjen" : "nacrt",
          req.user.id
        );
        const insert = db.prepare(`
          INSERT INTO stavke (dokument_id, artikal_id, kolicina, cena, pdv_stopa, rabat)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const s of clean) insert.run(result.lastInsertRowid, s.artikal_id, s.kolicina, s.cena, s.pdv_stopa, s.rabat);
        return result.lastInsertRowid;
      });
      const id = tx();
      res.status(201).json(dokumentSaStavkama(db, id));
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/dokumenti/:id", (req, res, next) => {
    try {
      const existing = db.prepare("SELECT * FROM dokumenti WHERE id = ?").get(Number(req.params.id));
      if (!existing) throw httpError(404, "Dokument nije pronađen.");
      if (existing.status !== "nacrt") throw httpError(400, "Može se menjati samo dokument u statusu nacrt.");
      const { datum, partner_id, napomena, stavke } = req.body || {};
      const partner = db.prepare("SELECT * FROM partneri WHERE id = ? AND aktivan = 1").get(Number(partner_id ?? existing.partner_id));
      if (!partner) throw httpError(400, "Partner nije pronađen.");
      const clean = validateStavke(stavke);
      const tx = db.transaction(() => {
        db.prepare("UPDATE dokumenti SET datum = ?, partner_id = ?, napomena = ? WHERE id = ?").run(
          datum || existing.datum,
          partner.id,
          napomena === undefined ? existing.napomena : String(napomena || "").trim() || null,
          existing.id
        );
        db.prepare("DELETE FROM stavke WHERE dokument_id = ?").run(existing.id);
        const insert = db.prepare(`
          INSERT INTO stavke (dokument_id, artikal_id, kolicina, cena, pdv_stopa, rabat)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const s of clean) insert.run(existing.id, s.artikal_id, s.kolicina, s.cena, s.pdv_stopa, s.rabat);
      });
      tx();
      res.json(dokumentSaStavkama(db, existing.id));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/dokumenti/:id/potvrdi", (req, res, next) => {
    try {
      const existing = db.prepare("SELECT * FROM dokumenti WHERE id = ?").get(Number(req.params.id));
      if (!existing) throw httpError(404, "Dokument nije pronađen.");
      if (existing.status !== "nacrt") throw httpError(400, "Samo nacrt se može potvrditi.");
      const stavke = db.prepare("SELECT * FROM stavke WHERE dokument_id = ?").all(existing.id);
      if (stavke.length === 0) throw httpError(400, "Dokument nema stavke.");
      const tx = db.transaction(() => {
        if (existing.tip === "izlaz") proveriZalihe(db, stavke);
        db.prepare("UPDATE dokumenti SET status = 'potvrdjen' WHERE id = ?").run(existing.id);
      });
      tx();
      res.json(dokumentSaStavkama(db, existing.id));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/dokumenti/:id/storniraj", (req, res, next) => {
    try {
      const existing = db.prepare("SELECT * FROM dokumenti WHERE id = ?").get(Number(req.params.id));
      if (!existing) throw httpError(404, "Dokument nije pronađen.");
      if (existing.status !== "potvrdjen") throw httpError(400, "Samo potvrđen dokument se može stornirati.");
      db.prepare("UPDATE dokumenti SET status = 'storniran' WHERE id = ?").run(existing.id);
      res.json(dokumentSaStavkama(db, existing.id));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/dokumenti/:id", (req, res, next) => {
    const existing = db.prepare("SELECT * FROM dokumenti WHERE id = ?").get(Number(req.params.id));
    if (!existing) return next(httpError(404, "Dokument nije pronađen."));
    if (existing.status !== "nacrt") return next(httpError(400, "Briše se samo nacrt."));
    db.prepare("DELETE FROM dokumenti WHERE id = ?").run(existing.id);
    res.json({ ok: true });
  });

  app.get("/api/stanje", (req, res) => {
    const q = `%${String(req.query.q || "").trim()}%`;
    const ispodMin = String(req.query.ispod_min || "") === "1";
    const rows = db.prepare(`
      SELECT a.id, a.sifra, a.naziv, a.jedinica_mere, a.nabavna_cena, a.prodajna_cena, a.min_stanje,
        COALESCE(SUM(CASE WHEN d.tip = 'ulaz' THEN s.kolicina WHEN d.tip = 'izlaz' THEN -s.kolicina ELSE 0 END), 0) AS stanje
      FROM artikli a
      LEFT JOIN stavke s ON s.artikal_id = a.id
      LEFT JOIN dokumenti d ON d.id = s.dokument_id AND d.status = 'potvrdjen'
      WHERE a.aktivan = 1 AND (a.sifra LIKE ? OR a.naziv LIKE ?)
      GROUP BY a.id
      ${ispodMin ? "HAVING stanje < a.min_stanje" : ""}
      ORDER BY a.sifra
    `).all(q, q);
    res.json(rows.map((r) => ({ ...r, vrednost: r.stanje * r.nabavna_cena })));
  });

  app.get("/api/stanje/:id/kartica", (req, res, next) => {
    const artikal = db.prepare("SELECT * FROM artikli WHERE id = ?").get(Number(req.params.id));
    if (!artikal) return next(httpError(404, "Artikal nije pronađen."));
    const od = String(req.query.od || "").trim();
    const doo = String(req.query.do || "").trim();
    const pokreti = db.prepare(`
      SELECT d.id AS dokument_id, d.broj, d.tip, d.datum, d.status, p.naziv AS partner_naziv,
        s.kolicina, s.cena
      FROM stavke s
      JOIN dokumenti d ON d.id = s.dokument_id
      JOIN partneri p ON p.id = d.partner_id
      WHERE s.artikal_id = ?
        AND (? = '' OR d.datum >= ?)
        AND (? = '' OR d.datum <= ?)
      ORDER BY d.datum, d.id
    `).all(artikal.id, od, od, doo, doo);
    let saldo = 0;
    const kartica = pokreti.map((p) => {
      const predznak = p.status === "potvrdjen" ? (p.tip === "ulaz" ? 1 : -1) : 0;
      const ulaz = p.tip === "ulaz" ? p.kolicina : 0;
      const izlaz = p.tip === "izlaz" ? p.kolicina : 0;
      saldo += predznak * p.kolicina;
      return { ...p, ulaz, izlaz, saldo };
    });
    res.json({ artikal: { ...artikal, stanje: stanjeArtikla(db, artikal.id) }, kartica });
  });

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Greška na serveru." });
  });

  return app;
}
