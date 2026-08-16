import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, danas, novac } from "../api.js";

function iznos(s) {
  const osnovica = Number(s.kolicina || 0) * Number(s.cena || 0) * (1 - Number(s.rabat || 0) / 100);
  const pdv = osnovica * (Number(s.pdv_stopa || 0) / 100);
  return { osnovica, pdv, ukupno: osnovica + pdv };
}

const emptyStavka = { artikal_id: "", kolicina: 1, cena: 0, pdv_stopa: 20, rabat: 0 };

export default function Dokument() {
  const { id, tip: tipParam } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [artikli, setArtikli] = useState([]);
  const [partneri, setPartneri] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState({
    tip: tipParam === "izlaz" ? "izlaz" : "ulaz",
    datum: danas(),
    partner_id: "",
    napomena: "",
    status: "nacrt",
    broj: isNew ? "biće dodeljen" : "",
    stavke: [{ ...emptyStavka }],
  });

  useEffect(() => {
    Promise.all([api("/api/artikli"), api("/api/partneri")])
      .then(([a, p]) => {
        setArtikli(a);
        setPartneri(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!id) return;
    api(`/api/dokumenti/${id}`).then((d) => {
      setDoc({
        ...d,
        partner_id: String(d.partner_id),
        stavke: d.stavke.map((s) => ({
          artikal_id: String(s.artikal_id),
          kolicina: s.kolicina,
          cena: s.cena,
          pdv_stopa: s.pdv_stopa,
          rabat: s.rabat,
        })),
      });
    }).catch((e) => setError(e.message));
  }, [id]);

  const readonly = !isNew && doc.status !== "nacrt";
  const totals = useMemo(() => {
    return doc.stavke.reduce((acc, s) => {
      const i = iznos(s);
      acc.osnovica += i.osnovica;
      acc.pdv += i.pdv;
      acc.ukupno += i.ukupno;
      return acc;
    }, { osnovica: 0, pdv: 0, ukupno: 0 });
  }, [doc.stavke]);

  function setStavka(index, patch) {
    const stavke = doc.stavke.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setDoc({ ...doc, stavke });
  }

  function onArtikal(index, artikalId) {
    const a = artikli.find((x) => String(x.id) === String(artikalId));
    const cena = doc.tip === "ulaz" ? a?.nabavna_cena : a?.prodajna_cena;
    setStavka(index, { artikal_id: artikalId, cena: cena ?? 0, pdv_stopa: a?.pdv_stopa ?? 20 });
  }

  function payload() {
    return {
      tip: doc.tip,
      datum: doc.datum,
      partner_id: Number(doc.partner_id),
      napomena: doc.napomena,
      stavke: doc.stavke.map((s) => ({
        artikal_id: Number(s.artikal_id),
        kolicina: Number(s.kolicina),
        cena: Number(s.cena),
        pdv_stopa: Number(s.pdv_stopa),
        rabat: Number(s.rabat || 0),
      })),
    };
  }

  async function sacuvaj(potvrdi) {
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const created = await api("/api/dokumenti", {
          method: "POST",
          body: JSON.stringify({ ...payload(), potvrdi }),
        });
        navigate(`/promet/${created.id}`, { replace: true });
      } else {
        await api(`/api/dokumenti/${id}`, { method: "PUT", body: JSON.stringify(payload()) });
        if (potvrdi) await api(`/api/dokumenti/${id}/potvrdi`, { method: "POST" });
        const refreshed = await api(`/api/dokumenti/${id}`);
        setDoc({
          ...refreshed,
          partner_id: String(refreshed.partner_id),
          stavke: refreshed.stavke.map((s) => ({
            artikal_id: String(s.artikal_id),
            kolicina: s.kolicina,
            cena: s.cena,
            pdv_stopa: s.pdv_stopa,
            rabat: s.rabat,
          })),
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function storniraj() {
    if (!confirm("Stornirati dokument? Zalihe će se vratiti.")) return;
    setBusy(true);
    try {
      const refreshed = await api(`/api/dokumenti/${id}/storniraj`, { method: "POST" });
      setDoc({ ...refreshed, partner_id: String(refreshed.partner_id), stavke: refreshed.stavke.map((s) => ({
        artikal_id: String(s.artikal_id), kolicina: s.kolicina, cena: s.cena, pdv_stopa: s.pdv_stopa, rabat: s.rabat,
      })) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function obrisi() {
    if (!confirm("Obrisati nacrt?")) return;
    await api(`/api/dokumenti/${id}`, { method: "DELETE" });
    navigate("/promet");
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>{isNew ? (doc.tip === "ulaz" ? "Novi ulaz" : "Novi izlaz") : doc.broj}</h1>
          <p>{doc.tip === "ulaz" ? "Prijem robe od dobavljača." : "Isporuka robe kupcu."}</p>
        </div>
        <div className="toolbar">
          {!readonly && <button className="btn" disabled={busy} onClick={() => sacuvaj(false)}>Sačuvaj nacrt</button>}
          {!readonly && <button className="btn secondary" disabled={busy} onClick={() => sacuvaj(true)}>Potvrdi</button>}
          {doc.status === "potvrdjen" && <button className="btn danger" disabled={busy} onClick={storniraj}>Storniraj</button>}
          {doc.status === "nacrt" && !isNew && <button className="ghost" onClick={obrisi}>Obriši</button>}
          <button className="ghost" onClick={() => navigate("/promet")}>Nazad</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="doc-head">
        <label>Broj<input value={doc.broj} disabled /></label>
        <label>Datum<input type="date" value={doc.datum} disabled={readonly} onChange={(e) => setDoc({ ...doc, datum: e.target.value })} /></label>
        <label>Status<input value={doc.status} disabled /></label>
        <label className="full" style={{ gridColumn: "1 / -1" }}>
          Partner
          <select value={doc.partner_id} disabled={readonly} onChange={(e) => setDoc({ ...doc, partner_id: e.target.value })}>
            <option value="">Izaberi partnera</option>
            {partneri.map((p) => <option key={p.id} value={p.id}>{p.naziv}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Napomena
          <textarea value={doc.napomena || ""} disabled={readonly} onChange={(e) => setDoc({ ...doc, napomena: e.target.value })} />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Artikal</th>
              <th className="num">Količina</th>
              <th className="num">Cena</th>
              <th className="num">Rabat %</th>
              <th className="num">PDV %</th>
              <th className="num">Iznos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {doc.stavke.map((s, i) => (
              <tr key={i}>
                <td>
                  <select value={s.artikal_id} disabled={readonly} onChange={(e) => onArtikal(i, e.target.value)}>
                    <option value="">Izaberi artikal</option>
                    {artikli.map((a) => (
                      <option key={a.id} value={a.id}>{a.sifra} — {a.naziv}</option>
                    ))}
                  </select>
                </td>
                <td><input type="number" step="0.001" value={s.kolicina} disabled={readonly} onChange={(e) => setStavka(i, { kolicina: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={s.cena} disabled={readonly} onChange={(e) => setStavka(i, { cena: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={s.rabat} disabled={readonly} onChange={(e) => setStavka(i, { rabat: e.target.value })} /></td>
                <td><input type="number" step="0.01" value={s.pdv_stopa} disabled={readonly} onChange={(e) => setStavka(i, { pdv_stopa: e.target.value })} /></td>
                <td className="num">{novac(iznos(s).ukupno)}</td>
                <td>
                  {!readonly && (
                    <button className="ghost" type="button" onClick={() => setDoc({ ...doc, stavke: doc.stavke.filter((_, j) => j !== i) })}>X</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readonly && (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="ghost" type="button" onClick={() => setDoc({ ...doc, stavke: [...doc.stavke, { ...emptyStavka }] })}>Dodaj stavku</button>
        </div>
      )}
      <div className="totals">
        <div>Osnovica<br /><strong>{novac(totals.osnovica)}</strong></div>
        <div>PDV<br /><strong>{novac(totals.pdv)}</strong></div>
        <div>Ukupno<br /><strong>{novac(totals.ukupno)}</strong></div>
      </div>
    </>
  );
}
