import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, kolicina, novac } from "../api.js";

const empty = {
  sifra: "",
  naziv: "",
  jedinica_mere: "kom",
  pdv_stopa: 20,
  nabavna_cena: 0,
  prodajna_cena: 0,
  min_stanje: 0,
};

export default function Artikli() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function load() {
    api(`/api/artikli?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, [q]);

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (form.id) await api(`/api/artikli/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      else await api("/api/artikli", { method: "POST", body: JSON.stringify(form) });
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Deaktivirati artikal?")) return;
    await api(`/api/artikli/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Artikli</h1>
          <p>Šifarnik robe sa cenama, PDV-om i minimalnim stanjem.</p>
        </div>
        <button className="btn" onClick={() => setForm({ ...empty })}>Novi artikal</button>
      </div>
      <div className="toolbar">
        <input placeholder="Pretraga po šifri ili nazivu" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && !form && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Šifra</th>
              <th>Naziv</th>
              <th>JM</th>
              <th className="num">Stanje</th>
              <th className="num">Nabavna</th>
              <th className="num">Prodajna</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="clickable" onClick={() => navigate(`/kartica/${a.id}`)}>{a.sifra}</td>
                <td>{a.naziv}</td>
                <td>{a.jedinica_mere}</td>
                <td className="num">{kolicina(a.stanje)}</td>
                <td className="num">{novac(a.nabavna_cena)}</td>
                <td className="num">{novac(a.prodajna_cena)}</td>
                <td className="row-actions">
                  <button className="ghost" onClick={() => setForm(a)}>Izmeni</button>
                  <button className="ghost" onClick={() => remove(a.id)}>Ukloni</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">Nema artikala za zadati filter.</div>}
      </div>
      {form && (
        <div className="modal-back" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? "Izmena artikla" : "Novi artikal"}</h2>
            {error && <div className="error">{error}</div>}
            <div className="form-grid">
              <label>Šifra<input value={form.sifra} onChange={(e) => setForm({ ...form, sifra: e.target.value })} required /></label>
              <label>Jedinica mere
                <select value={form.jedinica_mere} onChange={(e) => setForm({ ...form, jedinica_mere: e.target.value })}>
                  {["kom", "kg", "l", "m", "pak", "vrec"].map((j) => <option key={j}>{j}</option>)}
                </select>
              </label>
              <label className="full">Naziv<input value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} required /></label>
              <label>PDV %<input type="number" value={form.pdv_stopa} onChange={(e) => setForm({ ...form, pdv_stopa: e.target.value })} /></label>
              <label>Min. stanje<input type="number" value={form.min_stanje} onChange={(e) => setForm({ ...form, min_stanje: e.target.value })} /></label>
              <label>Nabavna cena<input type="number" step="0.01" value={form.nabavna_cena} onChange={(e) => setForm({ ...form, nabavna_cena: e.target.value })} /></label>
              <label>Prodajna cena<input type="number" step="0.01" value={form.prodajna_cena} onChange={(e) => setForm({ ...form, prodajna_cena: e.target.value })} /></label>
            </div>
            <div className="toolbar" style={{ marginTop: 16 }}>
              <button className="btn" type="submit">Sačuvaj</button>
              <button className="ghost" type="button" onClick={() => setForm(null)}>Otkaži</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
