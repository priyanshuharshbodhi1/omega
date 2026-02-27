import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/ui/navbar";
import {
  CornerDownRight,
  Search,
  Bot,
  Globe,
  Shield,
  Zap,
  Database,
  Brain,
  GitBranch,
  TrendingUp,
  FileText,
  Languages,
  ThumbsUp,
  MessageSquare,
  BarChart3,
  Upload,
  Code,
  QrCode,
  Link2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

function SectionTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9] bg-[#E9D8FD] px-3 py-1 rounded-full">
        {label}
      </span>
      <h2 className="font-display text-3xl sm:text-4xl text-[#1F1A15] mt-4 leading-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base text-[#4B3F35]">{description}</p>
      )}
    </div>
  );
}

export default async function Home() {
  const session = await auth();

  return (
    <div className="bg-[#EEE1CF] text-[#1F1A15] font-sans">
      {/* ── Hero ── */}
      <section className="min-h-screen relative overflow-hidden [background-image:radial-gradient(circle_at_top,_#fff8ed_0%,_#eee1cf_55%,_#e4d6c3_100%)]">
        <Navbar session={session} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(45,106,79,0.1),_transparent_45%),radial-gradient(circle_at_80%_30%,_rgba(124,58,237,0.12),_transparent_50%)]" />
        <div className="absolute -top-24 left-1/2 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-[#FFFDF7] opacity-60 blur-3xl" />
        <div className="absolute -bottom-24 right-[-6rem] h-80 w-80 rounded-full bg-[#E9D8FD] opacity-60 blur-3xl" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pt-40 pb-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
            <div className="pointer-events-none">
              <div className="mb-4 flex items-center gap-3 text-[#1F1A15] animate-[fade-in_0.85s_ease-out]">
                <div className="h-9 w-9 rounded-full bg-[#1F1A15] flex items-center justify-center">
                  <span className="text-[#D2F7D7] font-display text-base">
                    Ω
                  </span>
                </div>
                <span className="font-display text-lg tracking-[0.2em] uppercase">
                  Omega
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-[#1F1A15] animate-[fade-in_0.9s_ease-out]">
                Your AI <span className="text-brand">Customer&nbsp;Support</span> Agent
                {" "}<span className="text-brand">&</span> Feedback Platform
              </h1>
              <p className="mt-5 max-w-xl text-lg md:text-xl text-[#4B3F35] animate-[fade-in_1.05s_ease-out]">
                Add AI-powered customer support and smart feedback collection to
                any website with a single line of code. Arya answers from your
                knowledge base, escalates when unsure, and turns every
                conversation into actionable insights.
              </p>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#4B3F35] pointer-events-none animate-[fade-in_1.1s_ease-out]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  One script tag to integrate
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  Cited AI answers
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  6 languages
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  100% Elasticsearch
                </span>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 pointer-events-auto animate-[fade-in_1.2s_ease-out]">
                <Link href="https://www.youtube.com/watch?v=29ulpLYsDjM">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 rounded-full shadow-md hover:shadow transition-all hover:scale-[.98]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                      />
                    </svg>
                    Demo
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    variant="brand"
                    size="lg"
                    className="gap-2 rounded-full shadow-xl hover:shadow transition-all hover:scale-[.98]"
                  >
                    <CornerDownRight className="size-4" />
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>

            <div className="pointer-events-none hidden lg:block">
              <div className="relative h-full">
                <div className="absolute inset-0 rounded-[2.5rem] border border-[#D2C4B3] bg-[#FFFDF7]/70 shadow-[0_30px_80px_rgba(30,20,10,0.2)] backdrop-blur animate-[fade-in_1.1s_ease-out]" />
                <div className="absolute -top-6 -left-6 h-24 w-24 rounded-3xl border border-[#D2C4B3] bg-[#FFFDF7] shadow-[0_14px_30px_rgba(55,40,25,0.18)] animate-[float_6s_ease-in-out_infinite]" />
                <div className="absolute bottom-8 -right-8 h-32 w-32 rounded-3xl border border-[#D2C4B3] bg-[#E9D8FD] shadow-[0_14px_30px_rgba(76,29,149,0.22)] animate-[float_7s_ease-in-out_infinite]" />
                <div className="absolute inset-8 rounded-[2rem] border border-[#D2C4B3] bg-[radial-gradient(circle_at_top,_#fffdf7_0%,_#f7efe1_55%,_#efe4d4_100%)] shadow-inner" />
                <div className="absolute inset-12 rounded-3xl border border-[#D2C4B3] bg-[#FFFDF7] p-6 shadow-[0_18px_50px_rgba(55,40,25,0.15)]">
                  <div className="h-3 w-20 rounded-full bg-[#E6D8C6] mb-4" />
                  <div className="h-4 w-40 rounded-full bg-[#E6D8C6] mb-3" />
                  <div className="h-3 w-28 rounded-full bg-[#E6D8C6] mb-6" />
                  <div className="h-32 rounded-2xl border border-[#D2C4B3] bg-[#FFFDF7] shadow-[0_10px_24px_rgba(55,40,25,0.12)]" />
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="h-14 rounded-xl bg-[#E6D8C6]" />
                    <div className="h-14 rounded-xl bg-[#D2F7D7]" />
                    <div className="h-14 rounded-xl bg-[#E9D8FD]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Market Opportunity ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#1F1A15] rounded-3xl shadow-[0_20px_60px_rgba(55,40,25,0.25)] p-8 md:p-12 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
              <div className="space-y-4 max-w-lg">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#D2C4B3]">
                  Market Opportunity
                </span>
                <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
                  $10.7B
                </h2>
                <p className="text-base text-[#A89B8C] leading-relaxed">
                  The customer support automation market is projected to reach
                  $10.7 billion. 62% of customers now prefer AI-powered support
                  for faster resolution. Yet most businesses still juggle 3-4
                  separate tools for feedback collection, support chat, ticket
                  management, and analytics. Omega consolidates everything into
                  one Elasticsearch-native platform.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 min-w-[280px] lg:min-w-[320px]">
                <div className="rounded-2xl border border-[#3D3529] bg-[#2A241D] p-4">
                  <div className="text-2xl font-bold text-white">62%</div>
                  <div className="text-xs text-[#A89B8C] mt-1">
                    Customers prefer AI support
                  </div>
                </div>
                <div className="rounded-2xl border border-[#3D3529] bg-[#2A241D] p-4">
                  <div className="text-2xl font-bold text-white">73%</div>
                  <div className="text-xs text-[#A89B8C] mt-1">
                    Expect real-time responses
                  </div>
                </div>
                <div className="rounded-2xl border border-[#3D3529] bg-[#2A241D] p-4">
                  <div className="text-2xl font-bold text-white">3-4x</div>
                  <div className="text-xs text-[#A89B8C] mt-1">
                    Tools consolidated into one
                  </div>
                </div>
                <div className="rounded-2xl border border-[#3D3529] bg-[#2A241D] p-4">
                  <div className="text-2xl font-bold text-white">40%</div>
                  <div className="text-xs text-[#A89B8C] mt-1">
                    Support cost reduction
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What Omega Does (Dual Mode) ── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Dual Mode Platform"
            title="Two Products. One Platform."
            description="Omega combines feedback analytics and AI customer support into a single Elasticsearch-powered system."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_14px_36px_rgba(55,40,25,0.12)] p-8">
              <div className="rounded-xl bg-[#D2F7D7] w-12 h-12 flex items-center justify-center mb-5">
                <MessageSquare className="w-6 h-6 text-[#14532d]" />
              </div>
              <h3 className="font-display text-xl font-semibold text-[#1F1A15] mb-2">
                Feedback Analytics
              </h3>
              <p className="text-sm text-[#4B3F35] leading-relaxed mb-4">
                Collect feedback through embeddable widgets. Every submission is
                automatically analyzed for sentiment, stored in Elasticsearch,
                and enriched with semantic embeddings via an ingest pipeline.
              </p>
              <ul className="space-y-2">
                {[
                  "Auto sentiment classification (positive / neutral / negative)",
                  "Star ratings & text feedback in one widget",
                  "Real-time dashboard with ES|QL powered stats",
                  "Issue clustering groups similar complaints automatically",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-[#4B3F35]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_14px_36px_rgba(55,40,25,0.12)] p-8">
              <div className="rounded-xl bg-[#E9D8FD] w-12 h-12 flex items-center justify-center mb-5">
                <Bot className="w-6 h-6 text-[#6d28d9]" />
              </div>
              <h3 className="font-display text-xl font-semibold text-[#1F1A15] mb-2">
                Arya — AI Support Agent
              </h3>
              <p className="text-sm text-[#4B3F35] leading-relaxed mb-4">
                An AI customer support chatbot powered by Elastic Agent Builder.
                Arya retrieves answers using hybrid search (BM25 + KNN + RRF)
                and provides grounded, cited responses from your knowledge base.
              </p>
              <ul className="space-y-2">
                {[
                  "Hybrid search: BM25 lexical + KNN semantic + RRF fusion",
                  "Inline source citations — click to see the source",
                  "Confidence scoring on every answer",
                  "Smart escalation to human agents when unsure",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-[#4B3F35]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6d28d9] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Features Grid ── */}
      <section className="py-16 px-6 bg-[#FFFDF7]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Features"
            title="Everything You Need to Support Customers"
            description="From feedback collection to AI-powered answers, escalation, and analytics — all in one platform."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Search,
                title: "Hybrid Search",
                desc: "BM25 lexical search + KNN vector search combined with Reciprocal Rank Fusion for the most accurate answer retrieval.",
                tag: "Elasticsearch",
              },
              {
                icon: Bot,
                title: "Arya Support Agent",
                desc: "AI-powered support chatbot built on Elastic Agent Builder. Gives grounded, cited answers — never invents information.",
                tag: "Agent Builder",
              },
              {
                icon: Brain,
                title: "Sentiment Analysis",
                desc: "Every feedback is auto-classified as positive, neutral, or negative. Detect sentiment spikes with Elasticsearch Watcher alerts.",
                tag: "Elasticsearch",
              },
              {
                icon: Languages,
                title: "6-Language Support",
                desc: "Auto-detect customer language using Elastic inference endpoints. Respond in English, Hindi, Spanish, French, German, or Arabic.",
                tag: "Inference API",
              },
              {
                icon: ThumbsUp,
                title: "CSAT Feedback Loop",
                desc: "Thumbs up/down on every Arya answer. Ratings stored in Elasticsearch and tracked on the dashboard for quality monitoring.",
                tag: "Elasticsearch",
              },
              {
                icon: TrendingUp,
                title: "Issue Clustering",
                desc: "Similar complaints from feedback and support chats are automatically grouped into clusters. Send to Slack or create GitHub issues.",
                tag: "Agent Builder",
              },
              {
                icon: Shield,
                title: "Smart Escalation",
                desc: "When Arya's confidence drops below threshold, it suggests talking to a human. One click creates a ticket and pre-fills Gmail.",
                tag: "Workflows",
              },
              {
                icon: Zap,
                title: "Confidence Scoring",
                desc: "Every answer shows a confidence badge computed from RRF relevance scores. High, medium, or low — so customers know how reliable the answer is.",
                tag: "Elasticsearch",
              },
              {
                icon: Globe,
                title: "Embeddable Widget",
                desc: "Drop-in widget for any website. Supports feedback mode and support mode. Customize colors, position, text, and branding.",
                tag: "Integration",
              },
              {
                icon: BarChart3,
                title: "Real-time Dashboard",
                desc: "Live stats powered by ES|QL: total feedback, sentiment distribution, top keywords (significant_text agg), resolution rate, and CSAT.",
                tag: "ES|QL",
              },
              {
                icon: Upload,
                title: "Knowledge Indexing",
                desc: "Index URLs (auto-crawled) and PDFs into Elasticsearch with semantic embeddings. This is what Arya searches to find answers.",
                tag: "Ingest Pipeline",
              },
              {
                icon: MessageSquare,
                title: "Follow-up Suggestions",
                desc: "After every answer, Arya suggests 3 follow-up questions based on the retrieved context. Keeps customers engaged and self-serving.",
                tag: "Agent Builder",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#E6D8C6] bg-white p-5 hover:shadow-[0_10px_30px_rgba(55,40,25,0.1)] transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-[#F5EDE3] p-2">
                      <feature.icon className="w-4 h-4 text-[#4B3F35]" />
                    </div>
                    <span className="text-sm font-semibold text-[#1F1A15]">
                      {feature.title}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#6d28d9] bg-[#F3EDFF] px-2 py-0.5 rounded-full">
                    {feature.tag}
                  </span>
                </div>
                <p className="text-xs text-[#6B5E50] leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works (Flow) ── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="How It Works"
            title="From Setup to Live Support in Minutes"
            description="Three simple steps to transform your customer support."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Index Your Knowledge",
                desc: "Paste a URL or upload a PDF. Omega crawls the content, chunks it, and indexes it into Elasticsearch with semantic embeddings using an ingest pipeline. This becomes Arya's knowledge base.",
                icon: Upload,
              },
              {
                step: "02",
                title: "Embed the Widget",
                desc: "Copy one line of code — a script tag — and paste it into your website. Choose between feedback mode (collect feedback) or support mode (Arya chatbot). Customize colors and branding.",
                icon: Code,
              },
              {
                step: "03",
                title: "Monitor & Act",
                desc: "Watch feedback and support conversations in real-time on the dashboard. Issue clusters auto-form. Send them to Slack or create GitHub issues. Track resolution rate and CSAT score.",
                icon: BarChart3,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.1)] p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-full bg-[#1F1A15] w-10 h-10 flex items-center justify-center text-white font-bold text-sm">
                    {item.step}
                  </div>
                  <item.icon className="w-5 h-5 text-[#4B3F35]" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#1F1A15] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[#4B3F35] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integration Methods ── */}
      <section className="py-16 px-6 bg-[#FFFDF7]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Integration"
            title="Three Ways to Integrate"
            description="Embed the widget, share a link, or generate a QR code — whatever fits your workflow."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#D2C4B3] rounded-2xl p-6">
              <div className="rounded-lg bg-[#1F1A15] w-10 h-10 flex items-center justify-center mb-4">
                <Code className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-[#1F1A15] mb-2">
                Embed Script
              </h3>
              <p className="text-sm text-[#4B3F35] mb-3">
                Copy a single script tag and paste it into your website HTML.
                The widget renders automatically.
              </p>
              <code className="text-xs bg-[#F5EDE3] px-3 py-2 rounded-lg block text-[#4B3F35] break-all">
                {`<script src="omega.js" omega-id="your-id"></script>`}
              </code>
            </div>
            <div className="bg-white border border-[#D2C4B3] rounded-2xl p-6">
              <div className="rounded-lg bg-[#1F1A15] w-10 h-10 flex items-center justify-center mb-4">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-[#1F1A15] mb-2">
                Direct Link
              </h3>
              <p className="text-sm text-[#4B3F35] mb-3">
                Share a direct URL to your feedback or support page. Works in
                emails, Slack messages, or social media posts.
              </p>
              <div className="text-xs bg-[#F5EDE3] px-3 py-2 rounded-lg text-[#4B3F35]">
                omega.app/collect/your-widget-id
              </div>
            </div>
            <div className="bg-white border border-[#D2C4B3] rounded-2xl p-6">
              <div className="rounded-lg bg-[#1F1A15] w-10 h-10 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-[#1F1A15] mb-2">QR Code</h3>
              <p className="text-sm text-[#4B3F35] mb-3">
                Generate a QR code for physical products, receipts, or in-store
                displays. Customers scan to give feedback or chat with Arya.
              </p>
              <div className="text-xs bg-[#F5EDE3] px-3 py-2 rounded-lg text-[#4B3F35]">
                Auto-generated in the Integration tab
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Arya Support Agent Deep Dive ── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Arya Agent"
            title="How Arya Finds the Right Answer"
            description="A step-by-step look at Arya's retrieval and response pipeline — fully powered by Elasticsearch."
          />
          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_14px_36px_rgba(55,40,25,0.12)] p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  step: "1",
                  title: "Language Detection",
                  desc: "Detect the customer's language using Elastic inference endpoints. Translate to English if needed for search.",
                  color: "bg-[#DCEBFF]",
                },
                {
                  step: "2",
                  title: "Hybrid Search",
                  desc: "Run BM25 (lexical) and KNN (vector) search in parallel on support_docs index. Fuse results with RRF.",
                  color: "bg-[#D2F7D7]",
                },
                {
                  step: "3",
                  title: "Agent Builder",
                  desc: "Pass retrieved context to the Elastic Agent Builder customer support agent. It generates a grounded response with citations.",
                  color: "bg-[#E9D8FD]",
                },
                {
                  step: "4",
                  title: "Respond & Score",
                  desc: "Clean response of internal jargon. Translate back to the user's language. Compute confidence score. Suggest follow-ups.",
                  color: "bg-[#FCE7C8]",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`rounded-xl ${item.color} p-5`}
                >
                  <div className="text-xs font-bold text-[#4B3F35] uppercase tracking-wider mb-2">
                    Step {item.step}
                  </div>
                  <h4 className="font-semibold text-[#1F1A15] text-sm mb-2">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#4B3F35] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Architecture ── */}
      <section className="py-16 px-6 bg-[#FFFDF7]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Architecture"
            title="Built on Elasticsearch"
            description="Zero external databases. Every feature runs on native Elasticsearch capabilities."
          />

          {/* Architecture Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
            {[
              {
                label: "AI Agents",
                value: "7",
                icon: Bot,
                desc: "Elastic Agent Builder",
              },
              {
                label: "ES|QL Tools",
                value: "15",
                icon: Database,
                desc: "Real-time queries",
              },
              {
                label: "Workflows",
                value: "3",
                icon: GitBranch,
                desc: "Automated pipelines",
              },
              {
                label: "ES Indices",
                value: "10",
                icon: FileText,
                desc: "Full data layer",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[#D2C4B3] bg-white p-5 flex items-start gap-4 shadow-[0_8px_24px_rgba(55,40,25,0.08)]"
              >
                <div className="rounded-lg bg-[#1F1A15] p-2.5 text-white shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#1F1A15] leading-tight">
                    {item.value}
                  </div>
                  <div className="text-sm font-medium text-[#4B3F35]">
                    {item.label}
                  </div>
                  <div className="text-xs text-[#6B5E50] mt-0.5">
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ES Features Grid */}
          <div className="bg-white border border-[#D2C4B3] rounded-2xl p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#4B3F35] mb-1">
              Elasticsearch Features Used
            </h3>
            <p className="text-xs text-[#6B5E50] mb-5">
              Every capability below is a native Elasticsearch feature — no
              external services, no third-party databases.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                "Elastic Agent Builder",
                "ES|QL Queries",
                "Hybrid Search (BM25+KNN)",
                "RRF Rank Fusion",
                "Ingest Pipelines",
                "Semantic Embeddings",
                "Continuous Transforms",
                "significant_text Agg",
                "Inference Endpoints",
                "Watcher Alerts",
                "Cardinality Aggs",
                "date_histogram Aggs",
              ].map((feature) => (
                <div
                  key={feature}
                  className="rounded-lg border border-[#E6D8C6] bg-[#FFFDF7] px-3 py-2.5 text-xs font-medium text-[#4B3F35] flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Indices Table ── */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Data Layer"
            title="10 Elasticsearch Indices"
            description="All data lives in Elasticsearch. No Prisma. No SQL. No external databases."
          />
          <div className="bg-[#FFFDF7] border border-[#D2C4B3] rounded-2xl shadow-[0_12px_30px_rgba(55,40,25,0.1)] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#D2C4B3] bg-[#F5EDE3]">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4B3F35]">
                    Index
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#4B3F35]">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8C6]">
                {[
                  ["feedback", "Customer feedback with sentiment + semantic embeddings (ingest pipeline)"],
                  ["support_docs", "Indexed knowledge base chunks with vector embeddings for Arya"],
                  ["support_conversations", "Chat message history with confidence scores and follow-ups"],
                  ["support_tickets", "Escalation tickets from dissatisfied customers"],
                  ["support_answer_feedback", "CSAT thumbs up/down ratings on Arya's answers"],
                  ["issue_clusters", "Auto-detected complaint clusters from feedback + support"],
                  ["feedback_daily_stats", "Continuous Transform: daily aggregated feedback metrics"],
                  ["action_audit_log", "Admin action history for compliance tracking"],
                  ["teams", "Team configuration and widget settings"],
                  ["users", "User accounts and authentication data"],
                ].map(([index, purpose]) => (
                  <tr key={index} className="hover:bg-[#F5EDE3]/50">
                    <td className="px-6 py-3">
                      <code className="text-xs font-mono bg-[#F5EDE3] px-2 py-0.5 rounded text-[#1F1A15]">
                        {index}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-xs text-[#4B3F35]">
                      {purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Agents Table ── */}
      <section className="py-16 px-6 bg-[#FFFDF7]">
        <div className="max-w-6xl mx-auto">
          <SectionTitle
            label="Agent Builder"
            title="7 AI Agents. 15 Tools. 3 Workflows."
            description="All orchestrated through Elastic Agent Builder — no hardcoded AI logic."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                name: "Customer Support Agent",
                desc: "The main Arya agent. Answers customer questions using retrieved context. Cites sources. Never invents information.",
                tools: "hybrid_search, get_sources, check_ticket_status",
              },
              {
                name: "Feedback Triage Agent",
                desc: "Classifies incoming feedback by sentiment, urgency, and category. Routes critical issues for immediate attention.",
                tools: "classify_feedback, route_urgent, update_status",
              },
              {
                name: "Insights Analyst Agent",
                desc: "Powers the AI Analysis page. Answers admin questions about feedback trends, common complaints, and patterns.",
                tools: "query_feedback_stats, get_clusters, trend_analysis",
              },
              {
                name: "Issue Clustering Agent",
                desc: "Groups similar complaints from feedback and support conversations. Generates Slack summaries and GitHub issue descriptions.",
                tools: "cluster_issues, generate_summary, create_github_issue",
              },
              {
                name: "Knowledge Gap Detector",
                desc: "Identifies questions Arya can't answer well. Highlights missing knowledge base topics for content teams.",
                tools: "detect_gaps, suggest_content",
              },
              {
                name: "Escalation Handler Agent",
                desc: "Manages the handoff from AI to human support. Creates tickets, notifies agents, preserves conversation context.",
                tools: "create_ticket, notify_agent, transfer_context",
              },
            ].map((agent) => (
              <div
                key={agent.name}
                className="bg-white border border-[#D2C4B3] rounded-2xl p-5"
              >
                <h4 className="font-semibold text-sm text-[#1F1A15] mb-1">
                  {agent.name}
                </h4>
                <p className="text-xs text-[#4B3F35] mb-3 leading-relaxed">
                  {agent.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.split(", ").map((tool) => (
                    <span
                      key={tool}
                      className="text-[9px] font-mono bg-[#F5EDE3] px-2 py-0.5 rounded text-[#4B3F35]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl text-[#1F1A15] mb-4">
            Omega is the customer support agent your business will hire.
          </h2>
          <p className="text-base text-[#4B3F35] mb-8">
            One platform. Powered entirely by Elasticsearch. Replace your
            feedback tools, support chat, ticket system, and analytics dashboard
            — all in one.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button
                variant="brand"
                size="lg"
                className="gap-2 rounded-full shadow-xl hover:shadow transition-all hover:scale-[.98]"
              >
                <CornerDownRight className="size-4" />
                Get Started Free
              </Button>
            </Link>
            <Link href="https://youtu.be/-BkMrIukKYo">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-full shadow-md hover:shadow transition-all hover:scale-[.98]"
              >
                Watch Demo
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#D2C4B3] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B5E50]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[#1F1A15] flex items-center justify-center">
              <span className="text-[#D2F7D7] font-display text-[10px]">
                Ω
              </span>
            </div>
            <span className="font-display text-sm tracking-[0.15em] uppercase text-[#1F1A15]">
              Omega
            </span>
          </div>
          <p>
            Built for the Elasticsearch Agent Builder Hackathon. Powered
            entirely by Elasticsearch.
          </p>
        </div>
      </footer>
    </div>
  );
}
