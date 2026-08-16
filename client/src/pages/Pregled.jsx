import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, novac } from "../api.js";

const tipLabel = { ulaz: "Ulaz", izlaz: "Izlaz" };
const statusLabel = { nacrt: "Nacrt", potvrdjen: "Potvrđen", storniran: "Storniran" };

export default function Pregled() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/api/pregled").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="hint">Učitavanje pregleda...</p>;

  return (
    <>
      <div className="top">
        <div>
          <h1>Pregled</h1>
          <p>Trenutno stanje skladišta i poslednji promet.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => navigate("/promet/novi/ulaz")}>Novi ulaz</button>
          <button className="btn secondary" onClick={() => navigate("/promet/novi/izlaz")}>Novi izlaz</button>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="label">Aktivni artikli</div><div className="value">{data.artikli}</div></div>
        <div className="card"><div className="label">Partneri</div><div className="value">{data.partneri}</div></div>
        <div className="card"><div className="label">Vrednost zaliha</div><div className="value">{novac(data.vrednost)}</div></div>
        <div className={`card ${data.ispodMin ? "warn" : ""}`}>
          <div className="label">Ispod minimuma</div>
          <div className="value">{data.ispodMin}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Broj</th>
              <th>Tip</th>
              <th>Datum</th>
              <th>Partner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.poslednji.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/promet/${d.id}`)}>
                <td>{d.broj}</td>
                <td><span className={`pill ${d.tip}`}>{tipLabel[d.tip]}</span></td>
                <td>{d.datum}</td>
                <td>{d.partner_naziv}</td>
                <td><span className={`pill ${d.status}`}>{statusLabel[d.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
