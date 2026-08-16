import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "./api.js";
import Pregled from "./pages/Pregled.jsx";
import Artikli from "./pages/Artikli.jsx";
import Partneri from "./pages/Partneri.jsx";
import Promet from "./pages/Promet.jsx";
import Dokument from "./pages/Dokument.jsx";
import Stanje from "./pages/Stanje.jsx";
import Kartica from "./pages/Kartica.jsx";

function Login({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card stack" onSubmit={submit}>
        <div>
          <h1>Evidencija prometa</h1>
          <p className="hint">Klijent se povezuje na server. Demo nalog: admin / admin123</p>
        </div>
        {error && <div className="error">{error}</div>}
        <label>
          Korisničko ime
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label>
          Lozinka
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>{busy ? "Prijava..." : "Prijavi se"}</button>
      </form>
    </div>
  );
}

function Layout({ user, onLogout, children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <small>Skladište</small>
          <strong>Promet robe</strong>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Pregled</NavLink>
          <NavLink to="/artikli">Artikli</NavLink>
          <NavLink to="/partneri">Partneri</NavLink>
          <NavLink to="/promet">Promet</NavLink>
          <NavLink to="/stanje">Stanje zaliha</NavLink>
        </nav>
        <div className="userbox">
          <span>{user.ime} · {user.uloga}</span>
          <button className="ghost" onClick={onLogout}>Odjava</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    api("/api/auth/me")
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  function onLogin(data) {
    setToken(data.token);
    setUser(data.user);
    navigate("/");
  }

  function onLogout() {
    setToken(null);
    setUser(null);
    navigate("/prijava");
  }

  if (!ready) return null;
  if (!user) {
    return (
      <Routes>
        <Route path="/prijava" element={<Login onLogin={onLogin} />} />
        <Route path="*" element={<Navigate to="/prijava" replace />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Pregled />} />
        <Route path="/artikli" element={<Artikli />} />
        <Route path="/partneri" element={<Partneri />} />
        <Route path="/promet" element={<Promet />} />
        <Route path="/promet/novi/:tip" element={<Dokument />} />
        <Route path="/promet/:id" element={<Dokument />} />
        <Route path="/stanje" element={<Stanje />} />
        <Route path="/kartica/:id" element={<Kartica />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
