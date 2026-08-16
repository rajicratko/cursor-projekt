import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
let token;
let artikalId;
let partnerId;

describe("API evidencije prometa", () => {
  before(() => {
    const db = createDb(":memory:");
    app = createApp(db);
  });

  it("health radi bez prijave", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it("štiti rute bez tokena", async () => {
    const res = await request(app).get("/api/artikli");
    assert.equal(res.status, 401);
  });

  it("prijavljuje admina", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    token = res.body.token;
  });

  it("odbija pogrešnu lozinku", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "pogresna" });
    assert.equal(res.status, 401);
  });

  it("vraća artikle i stanje iz početne zalihe", async () => {
    const res = await request(app).get("/api/artikli").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 10);
    const brasno = res.body.find((a) => a.sifra === "A-1001");
    assert.equal(brasno.stanje, 32);
    artikalId = brasno.id;
  });

  it("kreira artikal", async () => {
    const res = await request(app)
      .post("/api/artikli")
      .set("Authorization", `Bearer ${token}`)
      .send({ sifra: "A-2001", naziv: "Kisela voda 1.5 L", jedinica_mere: "kom", nabavna_cena: 40, prodajna_cena: 65, min_stanje: 24 });
    assert.equal(res.status, 201);
    assert.equal(res.body.naziv, "Kisela voda 1.5 L");
  });

  it("ne dozvoljava duplu šifru", async () => {
    const res = await request(app)
      .post("/api/artikli")
      .set("Authorization", `Bearer ${token}`)
      .send({ sifra: "A-2001", naziv: "Duplikat" });
    assert.equal(res.status, 409);
  });

  it("kreira partnera", async () => {
    const res = await request(app)
      .post("/api/partneri")
      .set("Authorization", `Bearer ${token}`)
      .send({ naziv: "Lokalna prodavnica", tip: "kupac", mesto: "Čačak" });
    assert.equal(res.status, 201);
    partnerId = res.body.id;
  });

  it("potvrđeni ulaz povećava stanje", async () => {
    const pre = await request(app).get(`/api/artikli/${artikalId}`).set("Authorization", `Bearer ${token}`);
    const res = await request(app)
      .post("/api/dokumenti")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tip: "ulaz",
        datum: "2026-03-01",
        partner_id: 1,
        napomena: "Dopuna zalihe",
        potvrdi: true,
        stavke: [{ artikal_id: artikalId, kolicina: 5, cena: 1850, pdv_stopa: 10, rabat: 0 }],
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "potvrdjen");
    assert.match(res.body.broj, /^ULZ-\d{4}-\d{4}$/);
    const posle = await request(app).get(`/api/artikli/${artikalId}`).set("Authorization", `Bearer ${token}`);
    assert.equal(posle.body.stanje, pre.body.stanje + 5);
  });

  it("odbija izlaz preko raspoloživog stanja", async () => {
    const res = await request(app)
      .post("/api/dokumenti")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tip: "izlaz",
        datum: "2026-03-02",
        partner_id: partnerId,
        potvrdi: true,
        stavke: [{ artikal_id: artikalId, kolicina: 9999, cena: 2290, pdv_stopa: 10 }],
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /zaliha/i);
  });

  it("potvrđeni izlaz smanjuje stanje, storno ga vraća", async () => {
    const pre = await request(app).get(`/api/artikli/${artikalId}`).set("Authorization", `Bearer ${token}`);
    const kreiran = await request(app)
      .post("/api/dokumenti")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tip: "izlaz",
        datum: "2026-03-03",
        partner_id: partnerId,
        potvrdi: true,
        stavke: [{ artikal_id: artikalId, kolicina: 3, cena: 2290, pdv_stopa: 10 }],
      });
    assert.equal(kreiran.status, 201);
    const posle = await request(app).get(`/api/artikli/${artikalId}`).set("Authorization", `Bearer ${token}`);
    assert.equal(posle.body.stanje, pre.body.stanje - 3);

    const storno = await request(app)
      .post(`/api/dokumenti/${kreiran.body.id}/storniraj`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(storno.status, 200);
    assert.equal(storno.body.status, "storniran");
    const vraceno = await request(app).get(`/api/artikli/${artikalId}`).set("Authorization", `Bearer ${token}`);
    assert.equal(vraceno.body.stanje, pre.body.stanje);
  });

  it("ne menja potvrđen dokument", async () => {
    const lista = await request(app).get("/api/dokumenti?status=potvrdjen").set("Authorization", `Bearer ${token}`);
    const id = lista.body[0].id;
    const res = await request(app)
      .put(`/api/dokumenti/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        datum: "2026-03-04",
        partner_id: 1,
        stavke: [{ artikal_id: artikalId, kolicina: 1, cena: 1 }],
      });
    assert.equal(res.status, 400);
  });

  it("kartica artikla ima saldo", async () => {
    const res = await request(app)
      .get(`/api/stanje/${artikalId}/kartica`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.kartica.length >= 2);
    const poslednji = res.body.kartica[res.body.kartica.length - 1];
    assert.equal(typeof poslednji.saldo, "number");
  });

  it("pregled vraća agregate", async () => {
    const res = await request(app).get("/api/pregled").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.artikli >= 10);
    assert.ok(res.body.vrednost > 0);
  });
});
