
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { InfoPacket } from '../types';

interface FieldVisualizerProps {
  packets: InfoPacket[];
  latestInnovation?: number;
}

const FieldVisualizer: React.FC<FieldVisualizerProps> = ({ packets, latestInnovation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll("*").remove();

    const data = packets.filter(p => p.embedding);
    if (data.length === 0) return;

    const margin = 60;
    const xScale = d3.scaleLinear().domain([0, 1]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height - margin, margin]);

    // Background Gradient
    const defs = svg.append("defs");
    const radialGradient = defs.append("radialGradient")
      .attr("id", "bg-glow")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    radialGradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(99, 102, 241, 0.05)");
    radialGradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(15, 23, 42, 0)");

    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#bg-glow)");

    // Grid lines
    svg.append("g")
      .attr("stroke", "rgba(255,255,255,0.03)")
      .selectAll("line.vertical")
      .data(xScale.ticks(10))
      .join("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", margin)
        .attr("y2", height - margin);

    svg.append("g")
      .attr("stroke", "rgba(255,255,255,0.03)")
      .selectAll("line.horizontal")
      .data(yScale.ticks(10))
      .join("line")
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("x1", margin)
        .attr("x2", width - margin);

    // Latest Innovation Highlight
    const latestObs = data.find(p => p.kind === 'observation');
    const latestSummary = data.find(p => p.kind === 'summary');

    if (latestObs?.embedding && latestSummary?.embedding) {
      svg.append("line")
        .attr("x1", xScale(latestSummary.embedding[0]))
        .attr("y1", yScale(latestSummary.embedding[1]))
        .attr("x2", xScale(latestObs.embedding[0]))
        .attr("y2", yScale(latestObs.embedding[1]))
        .attr("stroke", latestInnovation && latestInnovation > 0.4 ? "rgba(244, 63, 94, 0.4)" : "rgba(34, 211, 238, 0.2)")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4")
        .attr("class", "innovation-link");
      
      // Prediction Ghost
      svg.append("circle")
        .attr("cx", xScale(latestSummary.embedding[0]))
        .attr("cy", yScale(latestSummary.embedding[1]))
        .attr("r", 15)
        .attr("fill", "none")
        .attr("stroke", "rgba(99, 102, 241, 0.3)")
        .attr("stroke-width", 1)
        .attr("class", "prediction-ghost")
        .style("filter", "blur(2px)");
    }

    // Connect parents
    data.forEach(p => {
      if (p.parents && p.parents.length > 0) {
        p.parents.forEach(parentId => {
          const parent = data.find(dp => dp.id === parentId);
          if (parent && parent.embedding && p.embedding) {
            svg.append("line")
              .attr("x1", xScale(parent.embedding[0]))
              .attr("y1", yScale(parent.embedding[1]))
              .attr("x2", xScale(p.embedding[0]))
              .attr("y2", yScale(p.embedding[1]))
              .attr("stroke", p.kind === 'summary' ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.1)")
              .attr("stroke-width", p.kind === 'summary' ? 2 : 1);
          }
        });
      }
    });

    // Nodes
    const nodes = svg.selectAll(".packet-node")
      .data(data)
      .join("g")
      .attr("class", "packet-node")
      .attr("transform", d => `translate(${xScale(d.embedding![0])}, ${yScale(d.embedding![1])})`);

    nodes.append("circle")
      .attr("r", d => d.kind === 'summary' ? 10 : 5)
      .attr("fill", d => {
        if (d.kind === 'observation') return "#22d3ee";
        if (d.kind === 'summary') return "#10b981";
        if (d.kind === 'self_model') return "#6366f1";
        return "#475569";
      })
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2)
      .style("filter", d => {
         if (d.kind === 'summary') return "drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))";
         if (d.id === latestObs?.id) return "drop-shadow(0 0 10px rgba(34, 211, 238, 0.6))";
         return "none";
      })
      .on("mouseenter", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", d.kind === 'summary' ? 14 : 8).attr("stroke", "#fff");
        
        const tooltip = svg.append("g").attr("id", "tooltip-layer");
        tooltip.append("rect")
          .attr("x", xScale(d.embedding![0]) + 15)
          .attr("y", yScale(d.embedding![1]) - 35)
          .attr("width", 120)
          .attr("height", 25)
          .attr("rx", 6)
          .attr("fill", "#1e293b")
          .attr("stroke", "rgba(255,255,255,0.1)");

        tooltip.append("text")
          .attr("x", xScale(d.embedding![0]) + 25)
          .attr("y", yScale(d.embedding![1]) - 18)
          .attr("fill", "white")
          .attr("font-size", "10px")
          .attr("font-family", "Fira Code")
          .text(`${d.kind.toUpperCase()} (${d.id.slice(0,4)})`);
      })
      .on("mouseleave", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", d.kind === 'summary' ? 10 : 5).attr("stroke", "#0f172a");
        svg.select("#tooltip-layer").remove();
      });

  }, [packets, latestInnovation]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0f1e]">
      <svg ref={svgRef} className="block w-full h-full"></svg>
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 p-3 glass rounded-xl border border-white/5 backdrop-blur-md">
        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Manifold Legend</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22d3ee] shadow-[0_0_5px_#22d3ee]"></span>
            <span className="text-[9px] font-bold text-slate-400">OBS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_5px_#10b981]"></span>
            <span className="text-[9px] font-bold text-slate-400">SUMMARY</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#6366f1] shadow-[0_0_5px_#6366f1]"></span>
            <span className="text-[9px] font-bold text-slate-400">SELF</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldVisualizer;
