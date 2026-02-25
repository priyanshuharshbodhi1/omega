"use client";

import { useEffect, useState, useRef } from "react";
import * as d3Force from "d3-force";

type Keyword = { value: string; count: number };

const BUBBLE_COLORS = [
  { bg: "#FCE7C8", text: "#1F1A15", border: "#D2C4B3" },
  { bg: "#D2F7D7", text: "#1F1A15", border: "#9CD4A7" },
  { bg: "#DCEBFF", text: "#1F1A15", border: "#AFC8EC" },
  { bg: "#F8E1D5", text: "#1F1A15", border: "#D9B8A6" },
  { bg: "#EAE4FF", text: "#1F1A15", border: "#C5B8E8" },
  { bg: "#FFE7EF", text: "#1F1A15", border: "#E4B9C8" },
];

export default function TopKeywords({ data }: { data: Keyword[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    if (!data || data.length === 0 || !containerRef.current) return;

    // We make a copy of the data to avoid mutating the prop directly
    const keywordData = [...data];
    
    const width = containerRef.current.clientWidth || 500;
    const height = 300; 

    const counts = keywordData.map((d) => d.count);
    const minCount = Math.min(...counts, 1);
    const maxCount = Math.max(...counts, 1);

    const simulationNodes = keywordData.map((d, i) => {
      // Scale bubble radius based on count — higher count = bigger bubble
      const normalizedBase = maxCount === minCount ? 0.5 : (d.count - minCount) / (maxCount - minCount);
      // Scale radius: min 28, max 58, proportional to count
      const r = 28 + normalizedBase * 30;

      return {
        ...d,
        r,
        x: width / 2 + (Math.random() - 0.5) * 150,
        y: height / 2 + (Math.random() - 0.5) * 150,
        colorIndex: i % BUBBLE_COLORS.length,
      };
    });

    // Custom force that pushes nodes back inside the container bounds
    function forceBoundary() {
      let nodes: any[] = [];
      function force() {
        for (const d of nodes) {
          const padding = 2;
          if (d.x - d.r < padding) d.vx += (padding + d.r - d.x) * 0.3;
          if (d.x + d.r > width - padding) d.vx -= (d.x + d.r - width + padding) * 0.3;
          if (d.y - d.r < padding) d.vy += (padding + d.r - d.y) * 0.3;
          if (d.y + d.r > height - padding) d.vy -= (d.y + d.r - height + padding) * 0.3;
        }
      }
      force.initialize = (n: any[]) => { nodes = n; };
      return force;
    }

    // Run physics simulation to pack bubbles without overlapping
    const simulation = d3Force.forceSimulation(simulationNodes)
      .force("charge", d3Force.forceManyBody().strength(2))
      .force("center", d3Force.forceCenter(width / 2, height / 2).strength(0.06))
      .force("collide", d3Force.forceCollide().radius((d: any) => d.r + 4).iterations(6).strength(1))
      .force("boundary", forceBoundary() as any)
      .stop();

    // Run enough ticks for a fully stable layout
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }

    // Final hard clamp as safety net
    const finalNodes = simulation.nodes().map((node: any) => ({
      ...node,
      x: Math.max(node.r + 1, Math.min(width - node.r - 1, node.x)),
      y: Math.max(node.r + 1, Math.min(height - node.r - 1, node.y)),
    }));

    setNodes(finalNodes);
  }, [data]);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <p className="text-sm text-[#4B3F35]">
        Not enough data yet. Keywords will appear once feedback/support traffic
        comes in.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-[300px] overflow-hidden rounded-xl">
      {nodes.map((node) => {
        const palette = BUBBLE_COLORS[node.colorIndex];
        
        // Font size perfectly scaled to radius so text never comes outside
        // Subtract horizontal padding estimation
        const fontSize = Math.max(10, Math.min(22, node.r / 3.2)); 
        
        return (
          <div
            key={node.value}
            className="absolute rounded-full border shadow-sm flex items-center justify-center text-center transition-transform hover:scale-105"
            style={{
              width: node.r * 2,
              height: node.r * 2,
              left: node.x - node.r,
              top: node.y - node.r,
              backgroundColor: palette.bg,
              color: palette.text,
              borderColor: palette.border,
              boxShadow: "inset -4px -4px 10px rgba(0,0,0,0.05), inset 4px 4px 10px rgba(255,255,255,0.5)",
            }}
            title={`${node.value}: ${node.count}`}
          >
            <div className="leading-tight px-3 w-full break-words flex flex-col items-center justify-center h-full">
              <div className="font-semibold px-1" style={{ fontSize: `${fontSize}px`, lineHeight: 1.1 }}>
                {node.value}
              </div>
              <div style={{ fontSize: `${Math.max(9, fontSize * 0.65)}px` }} className="opacity-70 mt-1 font-medium">
                {node.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
