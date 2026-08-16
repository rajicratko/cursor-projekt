import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, kolicina, novac } from "../api.js";

export default function Stanje() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [ispodMin, setIspodMin] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api(`/api/stanje?q=${encodeURIComponent(q)}&ispod_min=${ispodMin ? "1" : ""}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [q, ispodMin]);

  const ukupno = rows.reduce((s, r) => s + r.vrednost, 0);

  return (
    <>
      <div className="top">
        <div>
          <h1>Stanje zaliha</h1>
          <p>Stanje se računa samo iz potvrđenih dokumenata.</p>
        </div>
        <div className="value" style={{ fontFamily: "Source Serif 4, serif", fontSize: 28 }}>{novac(ukupno)}</div>
      </div>
      <div className="toolbar">
        <input placeholder="Pretraga artikla" value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8, color: "var(--ink)" }}>
          <input type="checkbox" checked={ispodMin} onChange={(e) => setIspodMin(e.target.checked)} />
          Samo ispod minimuma
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Šifra</th>
              <th>Naziv</th>
              <th>JM</th>
              <th className="num">Stanje</th>
              <th className="num">Minimum</th>
              <th className="num">Vrednost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => navigate(`/kartica/${r.id}`)}>
                <td>{r.sifra}</td>
                <td>{r.naziv}</td>
                <td>{r.jedinica_mere}</td>
                <td className="num">{kolicina(r.stanje)}</td>
                <td className="num">
                  {r.stanje < r.min_stanje
                    ? <span className="pill low">{kolicina(r.min_stanje)}</span>
                    : kolicina(r.min_stanje)}
                </td>
                <td className="num">{novac(r.vrednost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
