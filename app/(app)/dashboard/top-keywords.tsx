"use client";

import { TagCloud } from "react-tagcloud";

export default function TopKeywords({ data }: { data: any }) {
  return <TagCloud minSize={12} maxSize={35} tags={data} />;
}
