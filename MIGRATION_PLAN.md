# Zapfeed → Elasticsearch Agent Builder Migration Plan

## Goal

Migrate Zapfeed from TiDB to Elasticsearch with Agent Builder integration to compete in the Elasticsearch Agent Builder Hackathon.

**Deadline**: February 27, 2026

---

## Phase 1: Setup & Foundation (Day 1)

### Step 1.1: Create Elastic Cloud Account

**What to do:**

1. Go to [https://cloud.elastic.co](https://cloud.elastic.co)
2. Sign up for free trial (14 days, no credit card)
3. Create a new deployment:
   - Name: `zapfeed`
   - Region: Choose closest to you
   - Version: Latest (9.x)
   - Size: Start with smallest (you can scale later)

**Test checkpoint:**

```bash
# Save these values in .env:
ELASTIC_CLOUD_ID=your-cloud-id
ELASTIC_API_KEY=your-api-key
ELASTIC_KIBANA_URL=https://your-deployment.kb.region.cloud.es.io

# Test connection (run in terminal):
curl -X GET "${ELASTIC_KIBANA_URL}/api/status" \
  -H "Authorization: ApiKey ${ELASTIC_API_KEY}"
```

✅ **Success**: Returns JSON with "status": "available"

---

### Step 1.2: Create Elasticsearch Indices

**What to do:**
Open Kibana Dev Tools and run these commands:

```json
// Create feedback index
PUT /feedback
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "teamId": { "type": "keyword" },
      "customerId": { "type": "keyword" },
      "type": { "type": "keyword" },
      "rate": { "type": "integer" },
      "description": { "type": "text" },
      "aiResponse": { "type": "text" },
      "sentiment": { "type": "keyword" },
      "isResolved": { "type": "boolean" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" },
      "embedding": {
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine"
      }
    }
  }
}

// Create customers index
PUT /customers
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "teamId": { "type": "keyword" },
      "name": { "type": "text" },
      "email": { "type": "keyword" },
      "phone": { "type": "keyword" },
      "isVerified": { "type": "boolean" },
      "createdAt": { "type": "date" }
    }
  }
}

// Create teams index
PUT /teams
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text" },
      "description": { "type": "text" },
      "style": { "type": "object", "enabled": false },
      "createdAt": { "type": "date" }
    }
  }
}
```

**Test checkpoint:**

```json
// In Kibana Dev Tools:
GET /feedback/_mapping
GET /customers/_mapping
GET /teams/_mapping
```

✅ **Success**: All three return mapping definitions

---

## Phase 2: Full Elasticsearch Migration (ES-Only)

### Step 2.1: Uninstall Prisma & TiDB

**What to do:**

```bash
npm uninstall @auth/prisma-adapter @prisma/client @tidbcloud/prisma-adapter @tidbcloud/serverless
rm -rf prisma
```

### Step 2.2: Create Users Index

**What to do:**
Update `scripts/init-es-indices.ts` to include the `users` index:

```json
PUT /users
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text" },
      "email": { "type": "keyword" },
      "password": { "type": "keyword", "index": false },
      "currentTeamId": { "type": "keyword" },
      "createdAt": { "type": "date" }
    }
  }
}
```

### Step 2.3: Implement ES-Based Auth

**What to do:**
Modify `auth.ts` to use a custom Credentials provider that queries the `users` index directly via `esClient`.

### Step 2.4: Update All API Routes

Remove all Prisma leftovers and use `esClient` for:

- User registration
- User profile fetching
- Session management

---

### Step 2.2: Create Elasticsearch Client Utility

**What to do:**
Create new file `lib/elasticsearch.ts`:

```typescript
import { Client } from "@elastic/elasticsearch";

export const esClient = new Client({
  cloud: { id: process.env.ELASTIC_CLOUD_ID! },
  auth: { apiKey: process.env.ELASTIC_API_KEY! },
});

// Test connection function
export async function testConnection() {
  try {
    const info = await esClient.info();
    console.log("Connected to Elasticsearch:", info.version.number);
    return true;
  } catch (error) {
    console.error("Elasticsearch connection failed:", error);
    return false;
  }
}
```

**Test checkpoint:**
Create a simple test script `scripts/test-es.ts`:

```typescript
import { testConnection } from "../lib/elasticsearch";
testConnection().then(console.log);
```

Run:

```bash
npx tsx scripts/test-es.ts
```

✅ **Success**: Prints "Connected to Elasticsearch: 8.x.x" and "true"

---

### Step 2.3: Create Data Migration Script

**What to do:**
Create `scripts/migrate-to-es.ts` to copy data from TiDB to Elasticsearch.

> [!NOTE]
> Keep TiDB running during migration so you can copy existing data.

```typescript
// scripts/migrate-to-es.ts
import { PrismaClient } from "@prisma/client";
import { esClient } from "../lib/elasticsearch";

async function migrate() {
  const prisma = new PrismaClient();

  // Migrate teams
  const teams = await prisma.team.findMany();
  for (const team of teams) {
    await esClient.index({
      index: "teams",
      id: team.id,
      document: { ...team },
    });
  }
  console.log(`Migrated ${teams.length} teams`);

  // Migrate customers
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    await esClient.index({
      index: "customers",
      id: customer.id,
      document: { ...customer },
    });
  }
  console.log(`Migrated ${customers.length} customers`);

  // Migrate feedback
  const feedbacks = await prisma.feedback.findMany();
  for (const fb of feedbacks) {
    await esClient.index({
      index: "feedback",
      id: fb.id,
      document: { ...fb },
    });
  }
  console.log(`Migrated ${feedbacks.length} feedbacks`);

  await esClient.indices.refresh({ index: ["teams", "customers", "feedback"] });
  console.log("Migration complete!");
}

migrate().catch(console.error);
```

**Test checkpoint:**

```bash
npx tsx scripts/migrate-to-es.ts
```

Then verify in Kibana Dev Tools:

```json
GET /feedback/_count
GET /customers/_count
GET /teams/_count
```

✅ **Success**: Counts match your TiDB data

---

### Step 2.4: Replace Prisma Queries with Elasticsearch

**What to do:**
Update API routes one by one. Start with the simplest:

#### Update `app/api/feedback/route.ts`:

```typescript
// BEFORE (Prisma)
const feedbacks = await prisma.feedback.findMany({
  where: { teamId },
});

// AFTER (Elasticsearch)
import { esClient } from "@/lib/elasticsearch";

const result = await esClient.search({
  index: "feedback",
  query: {
    term: { teamId: teamId },
  },
  sort: [{ createdAt: "desc" }],
  size: 100,
});

const feedbacks = result.hits.hits.map((hit) => ({
  id: hit._id,
  ...hit._source,
}));
```

**Test checkpoint:**

1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Login and view dashboard

✅ **Success**: Dashboard loads with feedback data from Elasticsearch

---

## Phase 3: Agent Builder Integration (Day 4-5)

### Step 3.1: Enable Agent Builder

**What to do:**

1. Open Kibana
2. Go to **Search** → **Agent Builder** (or use URL: `{KIBANA_URL}/app/search_agent_builder`)
3. Agent Builder should be available (it's enabled by default on Elastic Cloud)

**Test checkpoint:**

- Open Agent Chat and try talking to the default agent

✅ **Success**: Agent responds to basic questions

---

### Step 3.2: Create Custom ES|QL Tools

**What to do:**
In Kibana → Agent Builder → Tools → New Tool:

#### Tool 1: Get Feedback Summary

```yaml
ID: zapfeed.get_feedback_summary
Name: Get Feedback Summary
Description: "Get a summary of all feedback for a team including sentiment breakdown and average rating"
Type: ES|QL
Query: |
  FROM feedback
  | WHERE teamId == ?teamId
  | STATS 
      total = COUNT(*),
      positive = COUNT(*) WHERE sentiment == "positive",
      negative = COUNT(*) WHERE sentiment == "negative",
      neutral = COUNT(*) WHERE sentiment == "neutral",
      avg_rating = AVG(rate)

Parameters:
  - teamId (string, required): The team ID to get feedback summary for
```

#### Tool 2: Search Feedback

```yaml
ID: zapfeed.search_feedback
Name: Search Feedback
Description: "Search feedback by keyword or topic"
Type: Index Search
Index Pattern: feedback
```

#### Tool 3: Get Recent Negative Feedback

```yaml
ID: zapfeed.get_negative_feedback
Name: Get Recent Negative Feedback
Description: "Get the most recent negative feedback items"
Type: ES|QL
Query: |
  FROM feedback
  | WHERE teamId == ?teamId AND sentiment == "negative"
  | SORT createdAt DESC
  | LIMIT 10

Parameters:
  - teamId (string, required): The team ID
```

**Test checkpoint:**
For each tool, use "Save and Test" → enter test parameters → Run

✅ **Success**: Each tool returns expected data

---

### Step 3.3: Create Custom Agent

**What to do:**
In Kibana → Agent Builder → Agents → New Agent:

```yaml
ID: zapfeed_analyst
Name: Zapfeed Feedback Analyst

Instructions: |
  You are Zapfeed's AI-powered feedback analyst. Your job is to help business owners 
  understand their customer feedback.

  When users ask about their feedback:
  1. Use get_feedback_summary to get overall statistics
  2. Use search_feedback to find specific topics
  3. Use get_negative_feedback to identify problems

  Always:
  - Provide actionable insights
  - Highlight patterns and trends
  - Suggest improvements based on feedback
  - Be concise but thorough

  Format responses in clear markdown with headers and bullet points.

Tools:
  - zapfeed.get_feedback_summary
  - zapfeed.search_feedback
  - zapfeed.get_negative_feedback
  - platform.core.execute_esql
  - platform.core.generate_esql
```

**Test checkpoint:**

1. Open Agent Chat
2. Select "zapfeed_analyst" agent
3. Ask: "Give me a summary of my feedback"
4. Ask: "What are customers complaining about?"

✅ **Success**: Agent uses your custom tools and returns meaningful insights

---

## Phase 4: Application Integration (Day 6-7)

### Step 4.1: Create Agent Builder API Client

**What to do:**
Create `lib/agent-builder.ts`:

```typescript
const KIBANA_URL = process.env.ELASTIC_KIBANA_URL;
const API_KEY = process.env.ELASTIC_API_KEY;

export async function chatWithAgent(
  agentId: string,
  message: string,
  conversationId?: string,
) {
  const response = await fetch(
    `${KIBANA_URL}/api/agent_builder/chat/v1/invoke`,
    {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
        "Content-Type": "application/json",
        "kbn-xsrf": "true",
      },
      body: JSON.stringify({
        agent_id: agentId,
        message: message,
        conversation_id: conversationId,
      }),
    },
  );

  return response.json();
}
```

**Test checkpoint:**
Create test script and run:

```bash
npx tsx scripts/test-agent.ts
```

✅ **Success**: Returns agent response

---

### Step 4.2: Update Chat API Route

**What to do:**
Replace `app/api/chat/route.ts`:

```typescript
import { chatWithAgent } from "@/lib/agent-builder";

export async function POST(req: Request) {
  const { messages, team } = await req.json();
  const userMessage = messages[messages.length - 1].content;

  // Add team context to the message
  const contextualMessage = `[Team ID: ${team.id}] ${userMessage}`;

  const response = await chatWithAgent("zapfeed_analyst", contextualMessage);

  return Response.json({ content: response.message });
}
```

**Test checkpoint:**

1. Start dev server: `npm run dev`
2. Login to Zapfeed
3. Open the AI Chat feature
4. Ask: "What's my feedback summary?"

✅ **Success**: Chat returns insights from Agent Builder

---

### Step 4.3: Update Dashboard Queries

**What to do:**
Update dashboard API to use ES|QL for analytics:

```typescript
// app/api/team/[id]/dashboard/route.ts
import { esClient } from "@/lib/elasticsearch";

export async function GET(req: Request, { params }) {
  const { id: teamId } = params;

  // Use ES|QL for aggregations
  const result = await esClient.esql.query({
    query: `
      FROM feedback
      | WHERE teamId == "${teamId}"
      | STATS 
          total = COUNT(*),
          positive = COUNT(*) WHERE sentiment == "positive",
          negative = COUNT(*) WHERE sentiment == "negative",
          avg_rating = AVG(rate)
    `,
  });

  return Response.json(result);
}
```

**Test checkpoint:**

1. View dashboard in browser
2. Check all metrics display correctly

✅ **Success**: Dashboard shows correct analytics

---

## Phase 5: Polish & Submit (Day 8-10)

### Step 5.1: Add Wow Factor Features (Optional)

Ideas to stand out:

- [ ] Real-time feedback alerts (Elasticsearch Watcher)
- [ ] Auto-categorization using ML
- [ ] Multi-agent workflow (analyzer → responder → action-taker)

---

### Step 5.2: Record Demo Video (3 minutes)

**Script:**
| Time | Content |
|------|---------|
| 0:00-0:30 | Problem: "Business owners struggle to analyze customer feedback" |
| 0:30-1:30 | Demo: Show dashboard, explain Elasticsearch integration |
| 1:30-2:15 | Demo: Show AI chat using Agent Builder, demonstrate tools |
| 2:15-2:45 | Technical: Show architecture diagram, mention ES|QL tools |
| 2:45-3:00 | Impact: "Zapfeed saves X hours of manual analysis" |

**Tools:**

- OBS Studio (free) or Loom for recording
- Canva for architecture diagram

**Test checkpoint:**

- Watch video yourself
- Is it under 3 minutes?
- Does it clearly show Agent Builder usage?

✅ **Success**: Video is clear, compelling, and under 3 minutes

---

### Step 5.3: Write Project Description (~400 words)

**Template:**

```markdown
# Zapfeed: AI-Powered Customer Feedback Analysis

## Problem

Businesses collect thousands of customer feedback entries but struggle
to extract actionable insights. Manual analysis is time-consuming and
often misses important patterns.

## Solution

Zapfeed uses Elasticsearch Agent Builder to create an intelligent
feedback analysis system that automatically:

- Categorizes feedback by sentiment
- Identifies trending issues
- Provides actionable recommendations
- Answers natural language questions about customer data

## Technical Implementation

Built with:

- **Elasticsearch** for storing and searching feedback data
- **Agent Builder** with custom ES|QL tools for intelligent analysis
- **Next.js** for the modern web interface

### Agent Builder Features Used

1. **Custom ES|QL Tools**: Created `get_feedback_summary`, `search_feedback`,
   and `get_negative_feedback` tools for precise data retrieval
2. **Custom Agent**: Built `zapfeed_analyst` with tailored instructions
3. **Semantic Search**: Leveraged built-in hybrid search for topic discovery

### Challenges

- Designing ES|QL queries that perform well on large datasets
- Creating effective agent instructions for consistent responses

### What We Liked

- The simplicity of creating custom tools in the UI
- How agents automatically choose the right tool for each question
- Built-in semantic search eliminated our manual embedding pipeline

## Impact

Zapfeed reduces feedback analysis time by 90%, turning hours of
manual work into seconds of AI-powered insights.
```

---

### Step 5.4: Social Media Post

**Post template:**

```
🚀 Just submitted Zapfeed to the @elastic Agent Builder Hackathon!

Built an AI-powered customer feedback system using:
✅ Elasticsearch for lightning-fast search
✅ Agent Builder for intelligent analysis
✅ Custom ES|QL tools for data retrieval

The best part? Agent Builder handles tool selection automatically!

Check it out: [GitHub link]

#ElasticAgentBuilder @elastic_devs
```

**Test checkpoint:**

- Post on X/Twitter
- Tag @elastic_devs

✅ **Success**: Post is live and tags visible

---

### Step 5.5: Submit to Hackathon

**Checklist:**

- [ ] Code pushed to public GitHub repo
- [ ] OSI-approved license added (MIT recommended)
- [ ] Demo video uploaded (YouTube/Loom)
- [ ] Description written
- [ ] Social post link ready

**Submit at:** [https://elasticsearch.devpost.com/](https://elasticsearch.devpost.com/)

✅ **Success**: Submission confirmed!

---

## Timeline Summary

| Day  | Phase           | Key Milestone                          |
| ---- | --------------- | -------------------------------------- |
| 1    | Setup           | Elastic Cloud running, indices created |
| 2-3  | Data Migration  | All data in Elasticsearch              |
| 4-5  | Agent Builder   | Custom agent and tools working         |
| 6-7  | App Integration | Full app working with ES               |
| 8-10 | Polish & Submit | Video, description, submission         |

---

## Verification Plan

### Automated Tests

Since the project uses Next.js, we'll verify by running:

```bash
npm run build # Ensure no build errors
npm run lint # Check for code issues
```

### Manual Tests

1. **Data Layer**: Query data in Kibana Dev Tools
2. **Agent Builder**: Test agents in Kibana Agent Chat
3. **Application**: Manual testing of all features in browser
4. **Video**: Self-review before submission
