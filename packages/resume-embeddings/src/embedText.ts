export async function embedText(text: string): Promise<number[]> {
  const res = await fetch("http://localhost:8001/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const data = await res.json();
  return data.embedding;
}