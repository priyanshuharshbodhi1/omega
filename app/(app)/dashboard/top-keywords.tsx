"use client";

type Keyword = { value: string; count: number };

const BUBBLE_COLORS = [
  "bg-[#FCE7C8] text-[#1F1A15] border-[#D2C4B3]",
  "bg-[#D2F7D7] text-[#1F1A15] border-[#9CD4A7]",
  "bg-[#DCEBFF] text-[#1F1A15] border-[#AFC8EC]",
  "bg-[#F8E1D5] text-[#1F1A15] border-[#D9B8A6]",
  "bg-[#EAE4FF] text-[#1F1A15] border-[#C5B8E8]",
  "bg-[#FFE7EF] text-[#1F1A15] border-[#E4B9C8]",
];

export default function TopKeywords({ data }: { data: Keyword[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <p className="text-sm text-[#4B3F35]">
        Not enough data yet. Keywords will appear once feedback/support traffic
        comes in.
      </p>
    );
  }

  const counts = data.map((item) => item.count || 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  return (
    <div className="flex flex-wrap gap-3">
      {data.map((item, idx) => {
        const normalized =
          maxCount === minCount
            ? 0.5
            : (item.count - minCount) / (maxCount - minCount);
        const size = Math.round(48 + normalized * 52);
        const palette = BUBBLE_COLORS[idx % BUBBLE_COLORS.length];

        return (
          <div
            key={item.value}
            className={`rounded-full border ${palette} shadow-sm flex items-center justify-center text-center px-3 transition-transform hover:scale-105`}
            style={{ width: size, height: size }}
            title={`${item.value}: ${item.count}`}
          >
            <div className="leading-tight">
              <div className="text-[11px] font-semibold">{item.value}</div>
              <div className="text-[10px] opacity-80">{item.count}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
