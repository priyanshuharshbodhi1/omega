import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { createGroq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";

export function getChatModel(temperature = 0.7) {
  const openAIKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (openAIKey && openAIKey.startsWith("sk-")) {
    return new ChatOpenAI({
      openAIApiKey: openAIKey,
      temperature,
    });
  }

  if (groqKey) {
    return new ChatGroq({
      apiKey: groqKey,
      model: "llama-3.3-70b-versatile",
      temperature,
    });
  }

  throw new Error("Missing AI API Keys (OpenAI or Groq)");
}

export function getAISDKModel() {
  const openAIKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (openAIKey && openAIKey.startsWith("sk-")) {
    return openai("gpt-4o-mini");
  }

  if (groqKey) {
    const groq = createGroq({
      apiKey: groqKey,
    });
    return groq("llama-3.3-70b-versatile");
  }

  throw new Error("Missing AI API Keys (OpenAI or Groq)");
}

export async function getEmbeddings(text: string) {
  const openAIKey = process.env.OPENAI_API_KEY;

  if (openAIKey && openAIKey.startsWith("sk-")) {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openAIKey,
      model: "text-embedding-3-small",
      dimensions: 1536,
    });
    return await embeddings.embedDocuments([text]);
  }

  // Fallback: If no OpenAI key, we return null for embeddings
  // The consumer should handle this by performing a keyword search instead of kNN
  return null;
}
