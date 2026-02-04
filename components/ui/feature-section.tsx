import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      title: "Built for developers",
      description: "Built for engineers, developers, dreamers, thinkers and doers.",
      icon: <Home />,
    },
    {
      title: "Ease of use",
      description: "It's as easy as using an Apple, and as expensive as buying one.",
      icon: <Home />,
    },
    {
      title: "Pricing like no other",
      description: "Our prices are best in the market. No cap, no lock, no credit card required.",
      icon: <Home />,
    },
    {
      title: "100% Uptime guarantee",
      description: "We just cannot be taken down by anyone.",
      icon: <Home />,
    },
    {
      title: "Multi-tenant Architecture",
      description: "You can simply share passwords instead of buying new seats",
      icon: <Home />,
    },
    {
      title: "24/7 Customer Support",
      description: "We are available a 100% of the time. Atleast our AI Agents are.",
      icon: <Home />,
    },
    {
      title: "Money back guarantee",
      description: "If you donot like EveryAI, we will convince you to like us.",
      icon: <Home />,
    },
    {
      title: "And everything else",
      description: "I just ran out of copy ideas. Accept my sincere apologies",
      icon: <Home />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4  relative z-10 py-10 max-w-7xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({ title, description, icon, index }: { title: string; description: string; icon: React.ReactNode; index: number }) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r border-white/20  py-10 relative group/feature",
        (index === 0 || index === 4) && "lg:border-l",
        index < 4 && "lg:border-b"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-black to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-black to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-gray-300">{icon}</div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 group-hover/feature:bg-brand transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-white">{title}</span>
      </div>
      <p className="text-sm text-gray-300 max-w-xs relative z-10 px-10">{description}</p>
    </div>
  );
};
