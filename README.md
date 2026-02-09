# Zapfeed

[Zapfeed](https://zapfeed.xyz) is a SaaS application designed for business owners to effortlessly collect, analyze, and act on customer feedback using the power of AI. With Zapfeed, you can gain valuable insights into customer sentiments, streamline your feedback processes, and enhance customer satisfaction.

## Features

- **Intuitive Dashboard**: Visualize your feedback data with metrics like total feedback, sentiment analysis, and trends.
- **AI-Powered Summaries**: Get instant summaries of feedback and actionable insights.
- **Customizable Widgets**: Easily integrate feedback collection into your website with customizable widgets.
- **Effortless Integration**: Embed Zapfeed with a single line of code, direct links, or QR codes.
- **AI Chat**: Interact with an AI chatbot to analyze feedback data and get insights.

## Technologies Used

- **Frontend**: Next.js
- **Backend**: [TiDB Serverless with Vector Search](https://www.pingcap.com/ai), OpenAI
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (version 14.x or later)
- A [TiDB Serverless with Vector Search](https://www.pingcap.com/ai) account
- An OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ahmadnurfadilah/zapfeed.git
   cd zapfeed
2. Install dependencies:
    ```bash
   npm install
3. Create a .env file in the root directory and add your environment variables:
    ```bash
    NEXT_PUBLIC_BASE_URL="http://localhost:3000"
    AUTH_SECRET=example
    DATABASE_URL=
    OPENAI_API_KEY=
4. Run prisma migrate dev to create the database schema:
    ```bash
    npx prisma generate
    npx prisma migrate dev
5. Run the development server:
    ```bash
    npm run dev
6. Open your browser and navigate to http://localhost:3000.
