import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, kolicina, novac } from "../api.js";

export default function Kartica() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/stanje/${id}/kartica`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="hint">Učitavanje kartice...</p>;

  return (
    <>
      <div className="top">
        <div>
          <h1>Kartica artikla</h1>
          <p>{data.artikal.sifra} — {data.artikal.naziv}</p>
        </div>
        <div className="toolbar">
          <div>Trenutno stanje: <strong>{kolicina(data.artikal.stanje)} {data.artikal.jedinica_mere}</strong></div>
          <button className="ghost" onClick={() => navigate("/stanje")}>Nazad na stanje</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Dokument</th>
              <th>Partner</th>
              <th>Status</th>
              <th className="num">Ulaz</th>
              <th className="num">Izlaz</th>
              <th className="num">Cena</th>
              <th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.kartica.map((p, i) => (
              <tr key={`${p.dokument_id}-${i}`} className="clickable" onClick={() => navigate(`/promet/${p.dokument_id}`)}>
                <td>{p.datum}</td>
                <td>{p.broj}</td>
                <td>{p.partner_naziv}</td>
                <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                <td className="num">{p.ulaz ? kolicina(p.ulaz) : ""}</td>
                <td className="num">{p.izlaz ? kolicina(p.izlaz) : ""}</td>
                <td className="num">{novac(p.cena)}</td>
                <td className="num">{kolicina(p.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.kartica.length === 0 && <div className="empty">Nema prometa za ovaj artikal.</div>}
      </div>
    </>
  );
}
