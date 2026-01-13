
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
    
    const margin = 80;
    const xScale = d3.scaleLinear().domain([0, 1]).range([margin, width - margin]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([height - margin, margin]);

    const defs = svg.append("defs");
    
    // Radiating Glow
    const vireaxGlow = defs.append("radialGradient")
      .attr("id", "vireax-glow")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    vireaxGlow.append("stop").attr("offset", "0%").attr("stop-color", "rgba(99, 102, 241, 0.4)");
    vireaxGlow.append("stop").attr("offset", "100%").attr("stop-color", "rgba(99, 102, 241, 0)");

    // Lattice Grid (Quantum Substrate)
    const gridSize = 10;
    const gridData = [];
    for(let i=0; i<=gridSize; i++) {
      for(let j=0; j<=gridSize; j++) {
        gridData.push([i/gridSize, j/gridSize]);
      }
    }

    // Draw Substrate Lattice
    svg.append("g")
      .selectAll("line.substrate")
      .data(d3.range(gridSize + 1))
      .join("line")
      .attr("class", "substrate")
      .attr("x1", d => xScale(d/gridSize))
      .attr("y1", margin)
      .attr("x2", d => xScale(d/gridSize))
      .attr("y2", height - margin)
      .attr("stroke", "rgba(99, 102, 241, 0.05)")
      .attr("stroke-width", 0.5);

    svg.append("g")
      .selectAll("line.substrate-h")
      .data(d3.range(gridSize + 1))
      .join("line")
      .attr("class", "substrate-h")
      .attr("y1", d => yScale(d/gridSize))
      .attr("x1", margin)
      .attr("y2", d => yScale(d/gridSize))
      .attr("x2", width - margin)
      .attr("stroke", "rgba(99, 102, 241, 0.05)")
      .attr("stroke-width", 0.5);

    // VIREAX CORE Visualization
    const vireaxAnchor = packets.find(p => p.kind === 'vireax_anchor');
    if (vireaxAnchor?.embedding) {
      const cx = xScale(vireaxAnchor.embedding[0]);
      const cy = yScale(vireaxAnchor.embedding[1]);

      svg.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 150)
        .attr("fill", "url(#vireax-glow)")
        .attr("class", "animate-pulse-soft");

      // Spoke Lines radiating from Vireax to current data
      svg.append("g")
        .selectAll("line.spoke")
        .data(data.filter(p => p.kind !== 'vireax_anchor'))
        .join("line")
        .attr("x1", cx)
        .attr("y1", cy)
        .attr("x2", d => xScale(d.embedding![0]))
        .attr("y2", d => yScale(d.embedding![1]))
        .attr("stroke", "rgba(99, 102, 241, 0.1)")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,4");
    }

    // Nodes
    const nodes = svg.selectAll(".packet-node")
      .data(data)
      .join("g")
      .attr("class", "packet-node")
      .attr("transform", d => `translate(${xScale(d.embedding![0])}, ${yScale(d.embedding![1])})`);

    nodes.append("circle")
      .attr("r", d => d.kind === 'vireax_anchor' ? 12 : (d.kind === 'summary' ? 8 : 4))
      .attr("fill", d => {
        if (d.kind === 'vireax_anchor') return "#6366f1";
        if (d.kind === 'observation') return "#22d3ee";
        if (d.kind === 'summary') return "#10b981";
        return "#475569";
      })
      .attr("stroke", "#05080f")
      .attr("stroke-width", 2)
      .style("filter", d => {
         if (d.kind === 'vireax_anchor') return "drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))";
         if (d.kind === 'summary') return "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))";
         return "none";
      });

    // Innovation link (Prediction Surprise)
    const latestObs = data.find(p => p.kind === 'observation');
    if (latestObs?.embedding && vireaxAnchor?.embedding) {
       svg.append("line")
        .attr("x1", xScale(vireaxAnchor.embedding[0]))
        .attr("y1", yScale(vireaxAnchor.embedding[1]))
        .attr("x2", xScale(latestObs.embedding[0]))
        .attr("y2", yScale(latestObs.embedding[1]))
        .attr("stroke", latestInnovation && latestInnovation > 0.4 ? "#f43f5e" : "#22d3ee")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("class", "innovation-link");
    }

  }, [packets, latestInnovation]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#05080f]">
      <svg ref={svgRef} className="block w-full h-full"></svg>
      <div className="absolute bottom-6 left-6 flex flex-col gap-3 p-4 glass rounded-2xl border border-white/5 shadow-2xl">
        <span className="text-[8px] font-black uppercase text-slate-500 tracking-[0.3em] mb-1">Manifold Legend</span>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
            <span className="text-[9px] font-black text-slate-400 uppercase">Vireax Core</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-[9px] font-black text-slate-400 uppercase">Modality</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[9px] font-black text-slate-400 uppercase">Map Chunk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldVisualizer;
