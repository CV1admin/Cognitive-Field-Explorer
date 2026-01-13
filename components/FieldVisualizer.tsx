
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { InfoPacket } from '../types';

interface FieldVisualizerProps {
  packets: InfoPacket[];
}

const FieldVisualizer: React.FC<FieldVisualizerProps> = ({ packets }) => {
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

    // Data filtering: only packets with embeddings
    const data = packets.filter(p => p.embedding);

    if (data.length === 0) return;

    const margin = 40;
    const xScale = d3.scaleLinear().domain([0, 1]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height - margin, margin]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("stroke", "rgba(255,255,255,0.05)")
      .attr("stroke-dasharray", "2,2")
      .call(g => g.append("g")
        .selectAll("line")
        .data(xScale.ticks(10))
        .join("line")
          .attr("x1", d => xScale(d))
          .attr("x2", d => xScale(d))
          .attr("y1", margin)
          .attr("y2", height - margin))
      .call(g => g.append("g")
        .selectAll("line")
        .data(yScale.ticks(10))
        .join("line")
          .attr("y1", d => yScale(d))
          .attr("y2", d => yScale(d))
          .attr("x1", margin)
          .attr("x2", width - margin));

    // Connect parents (simplified lineage)
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
              .attr("stroke", "rgba(99, 102, 241, 0.2)")
              .attr("stroke-width", 1);
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
      .attr("r", d => d.kind === 'summary' ? 8 : 4)
      .attr("fill", d => {
        if (d.kind === 'observation') return "#22d3ee";
        if (d.kind === 'summary') return "#10b981";
        if (d.kind === 'self_model') return "#6366f1";
        return "#94a3b8";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", d => d.kind === 'summary' ? 2 : 1)
      .attr("opacity", d => Math.max(0.4, d.confidence))
      .style("filter", d => d.kind === 'summary' ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))" : "none")
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", d.kind === 'summary' ? 12 : 8);
        
        // Simple tooltip
        svg.append("text")
          .attr("id", "tooltip")
          .attr("x", xScale(d.embedding![0]) + 10)
          .attr("y", yScale(d.embedding![1]) - 10)
          .attr("fill", "white")
          .attr("font-size", "10px")
          .attr("font-family", "monospace")
          .text(`${d.kind}: ${d.id.slice(0,6)}`);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", d.kind === 'summary' ? 8 : 4);
        svg.select("#tooltip").remove();
      });

    // Animate new nodes
    nodes.select("circle")
      .attr("opacity", 0)
      .transition()
      .duration(800)
      .attr("opacity", d => Math.max(0.4, d.confidence));

  }, [packets]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="block"></svg>
      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Observation
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Summary
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Self Model
        </div>
      </div>
    </div>
  );
};

export default FieldVisualizer;
