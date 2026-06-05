import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if (!OPENROUTER_API_KEY) {
  throw new Error("Missing OPENROUTER_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_TITLE = "RAG Exact Match Test";
const TEST_CATEGORY = "General Question";

const TEST_QUESTION = "Where is your office located?";

const TEST_ANSWER =
  "Strata Management Consultants is located at Ground Floor, 25 Milton Parade, Malvern VIC 3144.";

type RagMatch = {
  title: string;
  category: string | null;
  cosine_distance: number;
};

function clampNumber(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function confidenceFromCosineDistance(distance: number) {
  return clampNumber(1 - distance / 2);
}

async function requestOpenRouterEmbedding(input: string): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("Embedding response did not contain an embedding.");
  }

  return embedding;
}

async function main() {
  console.log("\n========== RAG EXACT MATCH TEST ==========");
  console.log("Supabase URL:", SUPABASE_URL);
  console.log("Test question:", TEST_QUESTION);

  console.log("\nGenerating embedding from exact question...");
  const questionEmbedding = await requestOpenRouterEmbedding(TEST_QUESTION);

  console.log("Embedding generated:", {
    isArray: Array.isArray(questionEmbedding),
    length: questionEmbedding.length,
    sample: questionEmbedding.slice(0, 5),
  });

  console.log("\nDeleting existing test row if it exists...");

  const { error: deleteError } = await supabase
    .from("enquiry_knowledge_base")
    .delete()
    .eq("title", TEST_TITLE);

  if (deleteError) {
    throw new Error(`Delete failed: ${deleteError.message}`);
  }

  console.log("Inserting test row...");

  const { data: inserted, error: insertError } = await supabase
    .from("enquiry_knowledge_base")
    .insert({
      title: TEST_TITLE,
      category: TEST_CATEGORY,
      content: `Question: ${TEST_QUESTION}\nAnswer: ${TEST_ANSWER}`,
      embedding: questionEmbedding,
    })
    .select("id, title, category")
    .single();

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  console.log("Inserted test row:", inserted);

  console.log("\nRunning RPC with the exact same question embedding...");

  const queryEmbedding = await requestOpenRouterEmbedding(TEST_QUESTION);

  const { data: matches, error: rpcError } = await supabase.rpc(
    "match_enquiry_kb",
    {
      query_embedding: queryEmbedding,
      match_count: 5,
    },
  );

  if (rpcError) {
    throw new Error(`RPC failed: ${rpcError.message}`);
  }

  console.log("\nTop matches:");
  const typedMatches = (matches ?? []) as RagMatch[];

  console.table(
    typedMatches.map((match, index) => {
      const confidence = confidenceFromCosineDistance(
        match.cosine_distance,
      );

      return {
        rank: index + 1,
        title: match.title,
        category: match.category,
        cosine_distance: match.cosine_distance,
        confidence,
        confidence_percent: `${(confidence * 100).toFixed(4)}%`,
      };
    }),
  );

  const topMatch = typedMatches[0];

  if (!topMatch) {
    console.log("\nNo match returned.");
    return;
  }

  const topConfidence = confidenceFromCosineDistance(
    topMatch.cosine_distance,
  );

  console.log("\nExpected top title:", TEST_TITLE);
  console.log("Actual top title:", topMatch.title);
  console.log("Top cosine distance:", topMatch.cosine_distance);
  console.log("Top confidence:", topConfidence);
  console.log("Top confidence percent:", `${(topConfidence * 100).toFixed(4)}%`);

  console.log("\n========== END RAG EXACT MATCH TEST ==========\n");
}

main().catch((error) => {
  console.error("\nScript failed:");
  console.error(error);
  process.exit(1);
});
