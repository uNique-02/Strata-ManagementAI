import type { SupabaseClient } from "@supabase/supabase-js";
import { requestOpenRouterEmbedding } from "@/lib/ai/embedding-request-helper";
import type { Database } from "@/lib/database.types";

type DBClient = SupabaseClient<Database>;

type RagMatch = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  cosine_distance: number;
};

function clampNumber(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * pgvector cosine operator (<=>) returns cosine distance
 *
 * 0   = identical
 * 1   = unrelated
 * 2   = opposite
 *
 * Convert distance -> confidence
 */
function confidenceFromCosineDistance(distance: number) {
  return clampNumber(1 - distance / 2);
}

export async function retrieveRagContext(args: {
  supabase: DBClient;
  enquiryText: string;
}) {
  console.log("\n========== RAG RETRIEVAL DEBUG ==========");
  console.log("Input enquiry:", args.enquiryText);

  console.log(
    "Supabase URL:",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  // Generate embedding
  const embedding = await requestOpenRouterEmbedding(
    args.enquiryText,
  );

  console.log("Embedding generated:", {
    isArray: Array.isArray(embedding),
    length: embedding.length,
    sample: embedding.slice(0, 5),
  });

  // Debug KB table
  const { data: kbRows, error: kbError } = await args.supabase
    .from("enquiry_knowledge_base")
    .select("id, title, embedding")
    .limit(5);

  console.log("\n========== KB TABLE DEBUG ==========");

  if (kbError) {
    console.error("KB table query error:", kbError);
  } else {
    console.log("KB rows found:", kbRows?.length ?? 0);

    console.table(
      (kbRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        has_embedding: !!row.embedding,
      })),
    );
  }

  console.log("========== END KB TABLE DEBUG ==========\n");

  // Run vector similarity search
  const { data, error } = await args.supabase.rpc(
    "match_enquiry_kb",
    {
      query_embedding: embedding,
      match_count: 5,
    },
  );

  if (error) {
    console.error("Supabase RAG RPC error:", error);

    console.log(
      "========== END RAG RETRIEVAL DEBUG ==========\n",
    );

    throw new Error(error.message);
  }

  const matches = (data ?? []) as RagMatch[];

  console.log("Raw RPC data:", data);
  console.log("Matches count:", matches.length);

  const topCosineDistance = matches[0]?.cosine_distance;

  const confidence =
    typeof topCosineDistance === "number"
      ? confidenceFromCosineDistance(topCosineDistance)
      : 0;

  console.log(
    "Top cosine distance:",
    topCosineDistance ?? null,
  );

  console.log("Computed confidence:", confidence);

  console.table(
    matches.map((match, index) => ({
      rank: index + 1,
      title: match.title,
      category: match.category,
      cosine_distance: match.cosine_distance,
      confidence: confidenceFromCosineDistance(
        match.cosine_distance,
      ),
    })),
  );

  const contextText = matches
    .map((match, index) => {
      const matchConfidence =
        confidenceFromCosineDistance(
          match.cosine_distance,
        );

      return `Source ${index + 1}: ${match.title}
Category: ${match.category ?? "Uncategorized"}
Cosine Distance: ${match.cosine_distance}
Confidence: ${matchConfidence}

${match.content}`;
    })
    .join("\n\n---\n\n");

  console.log(
    "Context text length:",
    contextText.length,
  );

  console.log(
    "Context preview:",
    contextText.slice(0, 1000),
  );

  console.log(
    "========== END RAG RETRIEVAL DEBUG ==========\n",
  );

  return {
    matches,
    confidence,
    cosineDistance: topCosineDistance ?? null,
    contextText,
  };
}
