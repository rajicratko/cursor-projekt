import { NextResponse } from "next/server";
import { addTask, listTasks } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title =
    typeof body === "object" && body !== null && "title" in body
      ? String((body as { title: unknown }).title ?? "").trim()
      : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const task = addTask(title);
  return NextResponse.json({ task }, { status: 201 });
}
