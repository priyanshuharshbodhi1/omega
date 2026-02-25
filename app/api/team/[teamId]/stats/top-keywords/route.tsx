import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";
import { stopWords } from "@/lib/stop-words";

const EXTRA_STOP_WORDS = [
  // greetings & pleasantries
  "please", "thanks", "thank", "hello", "hi", "hey", "dear", "regards",
  "okay", "ok", "yes", "no", "yeah", "yep", "nope", "sure",
  // generic verbs & auxiliaries
  "help", "need", "needs", "needed", "want", "wants", "wanted",
  "get", "got", "getting", "give", "gave", "given", "go", "going", "gone",
  "come", "came", "coming", "take", "took", "taken", "taking",
  "make", "made", "making", "try", "tried", "trying",
  "know", "knew", "known", "think", "thought", "feel", "felt",
  "say", "said", "saying", "tell", "told", "telling",
  "see", "saw", "seen", "look", "looked", "looking",
  "find", "found", "keep", "put", "let", "seem", "seemed",
  "ask", "asked", "asking", "work", "worked", "working",
  "call", "called", "calling", "run", "running",
  "provide", "provided", "providing",
  "happen", "happened", "happening",
  "start", "started", "starting",
  "show", "showed", "showing",
  "change", "changed", "changing",
  "move", "moved", "follow", "followed",
  "set", "turn", "turned", "leave", "left",
  // filler adverbs & adjectives
  "just", "very", "really", "much", "many", "more", "less", "most", "least",
  "also", "only", "even", "still", "already", "always", "never", "ever",
  "quite", "rather", "pretty", "almost", "well", "actually", "basically",
  "probably", "maybe", "perhaps", "simply", "often", "sometimes",
  "definitely", "certainly", "absolutely", "completely", "totally", "entirely",
  "especially", "particularly", "specifically", "currently", "recently",
  // generic pronouns & determiners
  "able", "another", "every", "either", "neither", "several",
  "enough", "lot", "lots", "bit", "whole", "entire",
  // generic nouns
  "thing", "things", "something", "anything", "everything", "nothing",
  "way", "ways", "time", "times", "day", "days", "today", "yesterday",
  "week", "month", "year", "number", "part", "parts",
  "place", "point", "case", "fact", "kind", "sort", "type",
  "end", "area", "side", "line", "level", "rest",
  "people", "person", "one", "ones", "someone", "anyone", "everyone",
  "example", "info", "information", "question", "answer", "problem",
  "issue", "issues", "reason", "result",
  // tech/platform generic
  "app", "website", "site", "page", "pages", "link", "url", "click", "button",
  "screen", "window", "tab", "section", "option", "menu",
  "team", "user", "users", "customer", "customers", "account", "email",
  "support", "omega", "chatbot", "bot", "message", "messages",
  "using", "used", "use",
  "send", "sent", "receive", "received",
  "open", "opened", "close", "closed",
  "add", "added", "remove", "removed", "delete", "deleted",
  "update", "updated", "create", "created",
  // misc filler
  "like", "etc", "would", "could", "should", "might", "may",
  "back", "new", "old", "first", "last", "next", "different", "same",
  "good", "bad", "great", "best", "better", "worst", "worse",
  "big", "small", "long", "short", "high", "low",
  "right", "wrong", "true", "false",
  "around", "since", "ago", "now", "soon", "later",
  "across", "along", "within", "without", "towards", "upon",
  "however", "though", "although", "whether", "whenever", "wherever",
  "therefore", "thus", "hence", "instead", "otherwise",
  "yet", "still", "already", "anymore",
  "via", "per", "regarding", "concerning",
  "available", "possible", "able", "unable",
  "suggest", "suggested", "recommend", "recommended",
  "check", "checked", "checking",
];

function normalizeWord(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function toBaseForm(rawToken: string) {
  let token = normalizeWord(rawToken);
  if (!token) return "";

  if (token.endsWith("ies") && token.length > 4) {
    token = `${token.slice(0, -3)}y`;
  } else if (/(ches|shes|xes|zes|sses)$/.test(token) && token.length > 5) {
    token = token.slice(0, -2);
  } else if (
    token.endsWith("s") &&
    token.length > 3 &&
    !/(ss|us|is)$/.test(token)
  ) {
    token = token.slice(0, -1);
  }

  if (token.endsWith("ing") && token.length > 6) {
    token = token.slice(0, -3);
    if (/([a-z])\1$/.test(token)) token = token.slice(0, -1);
  } else if (token.endsWith("ed") && token.length > 5) {
    token = token.slice(0, -2);
    if (/([a-z])\1$/.test(token)) token = token.slice(0, -1);
  }

  return token;
}

const STOP_WORDS = new Set(
  [...stopWords, ...EXTRA_STOP_WORDS]
    .map((word) => toBaseForm(word))
    .filter(Boolean),
);

function extractTokens(text: string) {
  const normalized = String(text || "").toLowerCase();
  const parts = normalized.match(/[a-z][a-z0-9'_-]{1,}/g) || [];

  return parts
    .map((token) => toBaseForm(token))
    .filter((token) => {
      if (!token) return false;
      if (token.length < 4) return false;
      if (/^\d+$/.test(token)) return false;
      if (STOP_WORDS.has(token)) return false;
      if (/^(http|https|www|com|net|org)$/.test(token)) return false;
      return true;
    });
}

export async function GET(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const teamId = params.teamId;

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const sinceIso = new Date(
      Date.now() - 45 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [feedbackRes, supportRes] = await Promise.all([
      esClient.search({
        index: process.env.ELASTIC_FEEDBACK_INDEX || "feedback",
        size: 700,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        _source: ["description"],
      }),
      esClient.search({
        index:
          process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX ||
          "support_conversations",
        size: 700,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { term: { role: "user" } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        _source: ["message"],
      }),
    ]);

    const counter = new Map<
      string,
      { total: number; feedback: number; support: number }
    >();

    for (const hit of feedbackRes.hits.hits) {
      const description = String((hit._source as any)?.description || "");
      const uniqueTokens = new Set(extractTokens(description));
      uniqueTokens.forEach((token) => {
        const prev = counter.get(token) || { total: 0, feedback: 0, support: 0 };
        counter.set(token, {
          total: prev.total + 1,
          feedback: prev.feedback + 1,
          support: prev.support,
        });
      });
    }

    for (const hit of supportRes.hits.hits) {
      const message = String((hit._source as any)?.message || "");
      const uniqueTokens = new Set(extractTokens(message));
      uniqueTokens.forEach((token) => {
        const prev = counter.get(token) || { total: 0, feedback: 0, support: 0 };
        counter.set(token, {
          total: prev.total + 1,
          feedback: prev.feedback,
          support: prev.support + 1,
        });
      });
    }

    const totalDocs = feedbackRes.hits.hits.length + supportRes.hits.hits.length;
    const minimumDocs =
      totalDocs >= 150 ? 3 : totalDocs >= 35 ? 2 : 1;

    const keywords = Array.from(counter.entries())
      .filter(([, stats]) => stats.total >= minimumDocs)
      .sort((a, b) => {
        const aStats = a[1];
        const bStats = b[1];
        const aCrossSignal = Math.min(aStats.feedback, aStats.support);
        const bCrossSignal = Math.min(bStats.feedback, bStats.support);
        const aScore = aStats.total + aCrossSignal * 0.35;
        const bScore = bStats.total + bCrossSignal * 0.35;
        return bScore - aScore;
      })
      .slice(0, 18)
      .map(([value, stats]) => ({ value, count: stats.total }));

    return NextResponse.json({
      success: true,
      message: "Success to get top keywords",
      data: keywords,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
