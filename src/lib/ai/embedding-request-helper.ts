import { getServerEnv } from "@/lib/env";

export async function requestOpenRouterEmbedding(input: string) {
  const env = getServerEnv();

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openRouterApiKey}`,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${text}`);
  }

  const payload = await response.json() as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("Embedding response did not contain an embedding.");
  }

  return embedding;
}