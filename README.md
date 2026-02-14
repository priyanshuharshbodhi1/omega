# Zapfeed: AI-Powered Customer Feedback Analysis

> **Hackathon Submission for Elastic Agent Builder Hackathon**

## 📋 Executive Summary

**Hackathon**: [Elasticsearch Agent Builder Hackathon](https://elasticsearch.devpost.com/)  
**Deadline**: February 27, 2026 at 1:00pm EST

Zapfeed helps businesses effortlessly gather, analyze, and act on customer feedback using the power of **Elasticsearch** and **AI**.

---

## 🚀 Key Features

- **Smart Feedback Collection**: Embeddable widgets for websites.
- **AI Analysis**: Automatically categorizes sentiment (Positive, Neutral, Negative) and generates summaries.
- **Elasticsearch Powered**:
  - **Vector Search**: Finds semantically related feedback using kNN.
  - **Full-Text Search**: Keyword matching for precise retrieval.
  - **Analytics**: Real-time dashboards powered by ES|QL.
- **Agent Builder Integration** (Planned): Custom AI agents to answer business questions about feedback trends.

---

## 🛠️ Technical Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Shadcn UI
- **Database**: Elasticsearch (Elastic Cloud) - Replaced TiDB/Prisma
- **AI**: OpenAI (Embeddings & Chat) / Groq (LPU Inference)
- **Auth**: NextAuth.js with Custom Elasticsearch Adapter

---

## 📦 Project Structure

```
├── app/               # Next.js App Router
│   ├── api/           # API Routes (Edge & Node.js)
│   ├── (app)/         # Dashboard & App UI
│   └── (auth)/        # Login/Register Pages
├── components/        # Reusable UI Components
├── lib/               # Utilities
│   ├── elasticsearch.ts # ES Client
│   └── llm.ts         # AI Model Configuration
├── scripts/           # Maintenance Scripts (Init Indices, Verify ES)
└── public/            # Static Assets
```

---

## 🏁 Hackathon Strategy & Implementation Plan

### Phase 1: Setup & Foundation (Completed)

- [x] Set up Elastic Cloud account and deployment
- [x] Create Elasticsearch indices (feedback, customers, embeddings)
- [x] Test: Verify indices are accessible via Kibana

### Phase 2: Full Elasticsearch Migration (ES-Only) (Completed)

- [x] Replace Prisma/TiDB with Elasticsearch client for business data
- [x] Migrate User storage and Authentication to Elasticsearch
- [x] Delete `schema.prisma` and remove Prisma/TiDB dependencies
- [x] Implement custom Auth.js credentials provider using Elasticsearch
- [x] Fix: Restore user-team relations in ES profile to prevent frontend crashes
- [x] Test: Production build succeeds and registration works via ES

### Phase 3: Agent Builder Integration (In Progress)

- [ ] Enable Agent Builder in Elastic Cloud
- [ ] Create custom ES|QL tools for feedback analysis
- [ ] Create zapfeed_analyst custom agent
- [ ] Test: Agent responds correctly in Kibana chat

### Phase 4: Application Integration

- [ ] Update API routes to use Agent Builder
- [ ] Replace chat endpoint with Agent Builder API
- [ ] Update dashboard queries to use ES|QL
- [ ] Test: Full application works end-to-end

### Phase 5: Polish & Submit

- [ ] Add multi-agent features (optional wow factor)
- [ ] Create 3-minute demo video
- [ ] Write ~400 word project description
- [ ] Share on social media (@elastic_devs)
- [ ] Submit to hackathon

---

## 💡 How to Run Locally

1.  **Clone the repo:**

    ```bash
    git clone https://github.com/yourusername/zapfeed.git
    cd zapfeed
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file with:

    ```env
    ELASTIC_CLOUD_ID=...
    ELASTIC_API_KEY=...
    ELASTIC_KIBANA_URL=...
    OPENAI_API_KEY=...
    GROQ_API_KEY=...
    NEXTAUTH_SECRET=...
    NEXT_PUBLIC_BASE_URL=http://localhost:3000
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

5.  **Open [http://localhost:3000](http://localhost:3000)**

---

## 🏆 Bottom Line: Can Zapfeed Win?

**Yes, with significant work.** The project has a solid foundation:

- ✅ Real-world use case (customer feedback)
- ✅ AI integration (OpenAI/Groq)
- ✅ Vector search capability
- ✅ Clean UI with Next.js

**Next Steps to Win:**

1.  **Migrate to Elasticsearch** - Done!
2.  **Implement Agent Builder** - The hackathon is about Agent Builder.
3.  **Build multi-agent architecture** - All winners had this.
4.  **Create a polished demo** - 30% of your score.
5.  **Share on social** - Free 10% bonus.
