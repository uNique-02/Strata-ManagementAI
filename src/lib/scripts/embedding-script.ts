import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { requestOpenRouterEmbedding } from "@/lib/ai/embedding-request-helper";
import { loadKnowledgeBaseText } from "@/lib/rag/load-knowledge-base";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);

async function seedKnowledgeBase() {
  const kbText = await loadKnowledgeBaseText();

  const chunks = kbText
    .split("---")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  console.log(`Found ${chunks.length} KB chunks.`);

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/TITLE:\s*(.*)/);
    const categoryMatch = chunk.match(/CATEGORY:\s*(.*)/);
    const contentMatch = chunk.match(/CONTENT:\s*([\s\S]*)/);

    const title = titleMatch?.[1]?.trim() ?? "Untitled";
    const category = categoryMatch?.[1]?.trim() ?? null;
    const content = contentMatch?.[1]?.trim() ?? chunk;

    console.log(`\nGenerating embedding for: ${title}`);

    const searchableText = `Title: ${title}
    Category: ${category ?? "Uncategorized"}
    Content:
    ${content}`;

    const embedding = await requestOpenRouterEmbedding(searchableText);

    console.log("Embedding length:", embedding.length);

    const { error } = await supabase
      .from("enquiry_knowledge_base")
      .insert({
        title,
        category,
        content,
        embedding,
      });

    if (error) {
      console.error("Insert error:", error);
    } else {
      console.log(`Inserted: ${title}`);
    }
  }

  console.log("\nKnowledge base embedding completed.");
}

seedKnowledgeBase().catch((error) => {
  console.error("Fatal script error:", error);
});