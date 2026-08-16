export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

// In-memory store. Persists for the lifetime of the server process, which is
// sufficient for a development/demo environment.
const tasks: Task[] = [];

export function listTasks(): Task[] {
  return [...tasks].sort((a, b) => b.createdAt - a.createdAt);
}

export function addTask(title: string): Task {
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    done: false,
    createdAt: Date.now(),
  };
  tasks.push(task);
  return task;
}

export function toggleTask(id: string): Task | undefined {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
  }
  return task;
}

export function removeTask(id: string): boolean {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return false;
  }
  tasks.splice(index, 1);
  return true;
}
