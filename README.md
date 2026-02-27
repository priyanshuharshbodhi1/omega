# Omega
[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=youtube)](https://www.youtube.com/watch?v=29ulpLYsDjM)

Omega is a high-performance, open-source SaaS platform designed for business owners to effortlessly collect, analyze, and act on customer feedback using the power of AI. Built with **Next.js** and **Elasticsearch**, Omega consolidates feedback collection, AI-powered support, and deep analytics into a single, cohesive platform.

## 🚀 Key Features

- **Arya — AI Support Agent**: An intelligent chatbot powered by **Elastic Agent Builder**. Arya retrieves answers using hybrid search (BM25 + KNN + RRF) and provides grounded, cited responses from your indexed knowledge base.
- **Embedded Integration**: Add AI-powered support and feedback collection to any website with a single line of code. No complex setups required.
- **Deep Sentiment Analysis**: Every piece of feedback is automatically analyzed for sentiment (positive, neutral, negative) and stored with semantic embeddings.
- **Issue Clustering**: Similar complaints and feedback are automatically grouped into clusters, helping you identify emerging trends and recurring issues instantly.
- **ES|QL Powered Dashboard**: Visualize your feedback data with real-time metrics, including sentiment distribution, average ratings, and resolution trends—all powered by native Elasticsearch queries.
- **Smart Escalation**: When Arya is unsure, it seamlessly suggests escalating to a human agent, ensuring your customers always get the help they need.

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion
- **Database/Search**: Elasticsearch (Cloud)
- **AI Orchestration**: Elastic Agent Builder
- **Language Models**: OpenAI / Groq / Gemini (via AI SDK)
- **Authentication**: NextAuth.js with Elasticsearch adapter

## 🏗️ Getting Started

### Prerequisites

- Node.js (v18 or later)
- An [Elastic Cloud](https://cloud.elastic.co) account
- An OpenAI (or compatible) API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/priyanshuharshbodhi1/omega.git
   cd omega
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"
   AUTH_SECRET=your_nextauth_secret
   ELASTIC_CLOUD_ID=your_elastic_cloud_id
   ELASTIC_API_KEY=your_elastic_api_key
   ELASTIC_KIBANA_URL=your_kibana_url
   OPENAI_API_KEY=your_openai_key
   ```

4. **Initialize Database**
   ```bash
   npx prisma generate
   # Note: Omega uses an Elasticsearch-first approach for production data. 
   # Use provided scripts to initialize your ES indices.
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📊 Documentation

- [Migration Plan](MIGRATION_PLAN.md) - Detailed steps for TiDB to Elasticsearch migration.
- [Hackathon Strategy](HACKATHON_STRATEGY.md) - Our approach for the Elastic Agent Builder Hackathon.
- [Demo Instructions](public/demo.html) - See how to integrate the Omega widget into any HTML site.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---
Built with ❤️ by the Omega team for the Elasticsearch Agent Builder Hackathon.
