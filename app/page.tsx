"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (!active) return;
        setTasks(data.tasks ?? []);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add task");
      return;
    }
    setTitle("");
    await refresh();
  }

  async function toggle(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH" });
    await refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await refresh();
  }

  const remaining = useMemo(
    () => tasks.filter((t) => !t.done).length,
    [tasks]
  );

  return (
    <main className="page">
      <div className="card">
        <header className="header">
          <h1>cursor-projekt</h1>
          <p className="subtitle">A full-stack task manager demo on Next.js</p>
        </header>

        <form className="add-form" onSubmit={addTask}>
          <input
            aria-label="New task title"
            className="input"
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="button" type="submit">
            Add
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="muted">No tasks yet. Add your first one above.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className="task">
                <label className="task-label">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggle(task.id)}
                  />
                  <span className={task.done ? "done" : ""}>{task.title}</span>
                </label>
                <button
                  className="delete"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => remove(task.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="footer">
          <span className="muted">
            {tasks.length} total · {remaining} remaining
          </span>
        </footer>
      </div>
    </main>
  );
}
