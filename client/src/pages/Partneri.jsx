import { useEffect, useState } from "react";
import { api } from "../api.js";

const empty = { naziv: "", pib: "", maticni_broj: "", adresa: "", mesto: "", telefon: "", email: "", tip: "oba" };
const tipLabel = { dobavljac: "Dobavljač", kupac: "Kupac", oba: "Dobavljač i kupac" };

export default function Partneri() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api(`/api/partneri?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, [q]);

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (form.id) await api(`/api/partneri/${form.id}`, { method: "PUT", body: JSON.stringify(form) });
      else await api("/api/partneri", { method: "POST", body: JSON.stringify(form) });
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Deaktivirati partnera?")) return;
    await api(`/api/partneri/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Partneri</h1>
          <p>Dobavljači i kupci koji učestvuju u prometu.</p>
        </div>
        <button className="btn" onClick={() => setForm({ ...empty })}>Novi partner</button>
      </div>
      <div className="toolbar">
        <input placeholder="Pretraga po nazivu ili PIB-u" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && !form && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Naziv</th>
              <th>PIB</th>
              <th>Mesto</th>
              <th>Tip</th>
              <th>Telefon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.naziv}</td>
                <td>{p.pib || "—"}</td>
                <td>{p.mesto || "—"}</td>
                <td>{tipLabel[p.tip]}</td>
                <td>{p.telefon || "—"}</td>
                <td className="row-actions">
                  <button className="ghost" onClick={() => setForm(p)}>Izmeni</button>
                  <button className="ghost" onClick={() => remove(p.id)}>Ukloni</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="modal-back" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? "Izmena partnera" : "Novi partner"}</h2>
            {error && <div className="error">{error}</div>}
            <div className="form-grid">
              <label className="full">Naziv<input value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} required /></label>
              <label>PIB<input value={form.pib || ""} onChange={(e) => setForm({ ...form, pib: e.target.value })} /></label>
              <label>Matični broj<input value={form.maticni_broj || ""} onChange={(e) => setForm({ ...form, maticni_broj: e.target.value })} /></label>
              <label>Adresa<input value={form.adresa || ""} onChange={(e) => setForm({ ...form, adresa: e.target.value })} /></label>
              <label>Mesto<input value={form.mesto || ""} onChange={(e) => setForm({ ...form, mesto: e.target.value })} /></label>
              <label>Telefon<input value={form.telefon || ""} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></label>
              <label>E-pošta<input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Tip
                <select value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })}>
                  <option value="dobavljac">Dobavljač</option>
                  <option value="kupac">Kupac</option>
                  <option value="oba">Dobavljač i kupac</option>
                </select>
              </label>
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
