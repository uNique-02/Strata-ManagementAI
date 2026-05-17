// src/lib/rag/load-knowledge-base.ts

import fs from "node:fs/promises";
import path from "node:path";

export async function loadKnowledgeBaseText() {
  const filePath = path.join(
    process.cwd(),
    "src/data/enquiry-knowledge-base.txt",
  );

  return fs.readFile(filePath, "utf-8");
}