import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const tipLabel = { ulaz: "Ulaz", izlaz: "Izlaz" };
const statusLabel = { nacrt: "Nacrt", potvrdjen: "Potvrđen", storniran: "Storniran" };

export default function Promet() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ q: "", tip: "", status: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const qs = new URLSearchParams(filters).toString();
    api(`/api/dokumenti?${qs}`).then(setRows).catch((e) => setError(e.message));
  }, [filters]);

  return (
    <>
      <div className="top">
        <div>
          <h1>Promet</h1>
          <p>Prijemnice (ulaz) i otpremnice (izlaz). Potvrda menja zalihe.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => navigate("/promet/novi/ulaz")}>Novi ulaz</button>
          <button className="btn secondary" onClick={() => navigate("/promet/novi/izlaz")}>Novi izlaz</button>
        </div>
      </div>
      <div className="filters toolbar">
        <input placeholder="Broj ili partner" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select value={filters.tip} onChange={(e) => setFilters({ ...filters, tip: e.target.value })}>
          <option value="">Svi tipovi</option>
          <option value="ulaz">Ulaz</option>
          <option value="izlaz">Izlaz</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Svi statusi</option>
          <option value="nacrt">Nacrt</option>
          <option value="potvrdjen">Potvrđen</option>
          <option value="storniran">Storniran</option>
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Broj</th>
              <th>Tip</th>
              <th>Datum</th>
              <th>Partner</th>
              <th className="num">Stavke</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/promet/${d.id}`)}>
                <td>{d.broj}</td>
                <td><span className={`pill ${d.tip}`}>{tipLabel[d.tip]}</span></td>
                <td>{d.datum}</td>
                <td>{d.partner_naziv}</td>
                <td className="num">{d.broj_stavki}</td>
                <td><span className={`pill ${d.status}`}>{statusLabel[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">Nema dokumenata za zadati filter.</div>}
      </div>
    </>
  );
}
