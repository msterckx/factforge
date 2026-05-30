"use client";

import { useState, useEffect, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { resolveImageUrl } from "@/lib/imageUrl";

export interface InfographField {
  label: string;
  value: string;
  barPct?: number;   // 0–100, renders a progress bar below the value
  accent?: boolean;  // highlights value in amber
}

export interface InfographData {
  countryIso2?:  string;
  country?:      string;
  typeLabel?:    string;
  fields?:       InfographField[];
  images?:       string[];
  description?:  string;
}

interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: { iso_a2: string; iso_a2_eh?: string; name: string } | null;
}

const NE_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

function CountryOutline({ iso2 }: { iso2: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !iso2) return;
    let aborted = false;
    fetch(NE_URL)
      .then((r) => r.json())
      .then((geo: { features: GeoFeature[] }) => {
        if (aborted) return;
        const feature = geo.features.find(
          (f) => (f.properties?.iso_a2_eh ?? f.properties?.iso_a2) === iso2 && f.geometry
        );
        if (!feature) return;
        const W = 110, H = 72;
        const projection = geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], feature as never);
        const pathGen = geoPath(projection);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = pathGen(feature as any);
        if (!d) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "#a7c957");
        path.setAttribute("fill-opacity", "0.25");
        path.setAttribute("stroke", "#a7c957");
        path.setAttribute("stroke-width", "1.2");
        el.appendChild(path);
      })
      .catch(() => {/* silent */});
    return () => { aborted = true; };
  }, [iso2]);

  return (
    <svg ref={svgRef} width="110" height="72" viewBox="0 0 110 72" className="flex-shrink-0" />
  );
}

interface Props {
  name:      string;
  data:      InfographData;
  onDismiss: () => void;
}

export default function InfographPanel({ name, data, onDismiss }: Props) {
  const images = (data.images ?? []).filter(Boolean);
  const fields = data.fields ?? [];
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setSlideIndex((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="relative w-[min(860px,95vw)] max-h-[90vh] rounded-2xl overflow-hidden bg-[#0f1e2b] text-white shadow-2xl flex flex-col animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-3 right-4 z-10 text-white/60 hover:text-white text-2xl leading-none"
        >
          ×
        </button>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Left: image slideshow */}
          <div className="relative sm:w-[42%] h-48 sm:h-auto flex-shrink-0 bg-[#0a131c]">
            {images.length > 0 ? (
              images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={resolveImageUrl(src)}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ${
                    i === slideIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 160 160" className="w-32 h-32 opacity-20">
                  <circle cx="80" cy="60" r="34" fill="#a0b4c8" />
                  <path d="M33 148c6-39 27-57 47-57s41 18 47 57H33Z" fill="#a0b4c8" />
                </svg>
              </div>
            )}

            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    aria-label={`Image ${i + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === slideIndex ? "bg-white" : "bg-white/35"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: data panel */}
          <div className="flex-1 flex flex-col px-6 py-5 overflow-y-auto">
            {data.typeLabel && (
              <div className="text-[10px] font-semibold text-[#a7c957] uppercase tracking-[0.2em] mb-1">
                {data.typeLabel}
              </div>
            )}

            <h2 className="text-xl font-bold text-white leading-tight mb-4">{name}</h2>

            {/* Fixed: country outline + name */}
            {(data.countryIso2 || data.country) && (
              <div className="flex items-center gap-4 pb-4 mb-4 border-b border-white/10">
                {data.countryIso2 && <CountryOutline iso2={data.countryIso2} />}
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Country</div>
                  <div className="text-sm font-semibold text-slate-100">{data.country}</div>
                </div>
              </div>
            )}

            {/* Variable fields */}
            {fields.length > 0 && (
              <div className="space-y-4 flex-1">
                {fields.map((f, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{f.label}</div>
                    <div className={`text-sm leading-snug ${f.accent ? "text-[#dda15e]" : "text-slate-100"}`}>
                      {f.value}
                    </div>
                    {f.barPct !== undefined && (
                      <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#a7c957] rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, f.barPct))}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {data.description && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{data.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
