"use client";

import { useState, useEffect, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";

export interface PersonInfographData {
  born:             string;
  died:             string;
  origin:           string;
  originCountryId?: number;
  role:             string;
  period:           string;
  ghostText?:       string;
  caption?:         string;
  images:           string[];
}

const NE_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_countries.geojson";

interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: { name: string; iso_a2?: string } | null;
}

function CountryOutline({ origin }: { origin: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !origin) return;
    let aborted = false;

    fetch(NE_URL)
      .then((r) => r.json())
      .then((geo: { features: GeoFeature[] }) => {
        if (aborted) return;
        const feature = geo.features.find(
          (f) => f.properties?.name === origin && f.geometry
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
        path.setAttribute("fill-opacity", "0.2");
        path.setAttribute("stroke", "#a7c957");
        path.setAttribute("stroke-width", "1.2");
        el.appendChild(path);
      })
      .catch(() => {/* silent */});

    return () => { aborted = true; };
  }, [origin]);

  return (
    <svg ref={svgRef} width="110" height="72" viewBox="0 0 110 72" className="flex-shrink-0" />
  );
}

interface Props {
  name: string;
  data: PersonInfographData;
  onDismiss: () => void;
}

export default function PersonInfographPanel({ name, data, onDismiss }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const images = data.images.filter(Boolean);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(
      () => setSlideIndex((i) => (i + 1) % images.length),
      3500
    );
    return () => clearInterval(id);
  }, [images.length]);

  const bornYear = data.born ? parseInt(data.born, 10) : null;
  const diedYear = data.died ? parseInt(data.died, 10) : null;
  const lifespan = bornYear && diedYear ? diedYear - bornYear : null;

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
                  src={src}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ${
                    i === slideIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))
            ) : (
              /* Placeholder when no images provided */
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 160 160" className="w-32 h-32 opacity-20">
                  <circle cx="80" cy="60" r="34" fill="#a0b4c8" />
                  <path d="M33 148c6-39 27-57 47-57s41 18 47 57H33Z" fill="#a0b4c8" />
                </svg>
              </div>
            )}

            {/* Slide dots */}
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
            {/* Type label */}
            <div className="text-[10px] font-semibold text-[#a7c957] uppercase tracking-[0.2em] mb-1">
              {data.period}
            </div>

            {/* Person name */}
            <h2 className="text-xl font-bold text-white leading-tight mb-4">{name}</h2>

            {/* Lifespan */}
            {(data.born || data.died) && (
              <div className="pb-4 mb-4 border-b border-white/10">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Lifespan</div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[#a7c957] font-tabular leading-none">{data.born}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Born</div>
                  </div>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: "100%", background: "linear-gradient(to right, #a7c957, rgba(167,201,87,0.35))" }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-[#a7c957]/60 font-tabular leading-none">{data.died}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Died</div>
                  </div>
                  {lifespan && (
                    <div className="text-[10px] text-slate-500 ml-1 whitespace-nowrap">{lifespan} yrs</div>
                  )}
                </div>
              </div>
            )}

            {/* Origin */}
            {data.origin && (
              <div className="flex items-center gap-4 pb-4 mb-4 border-b border-white/10">
                <CountryOutline origin={data.origin} />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Origin</div>
                  <div className="text-sm font-semibold text-slate-100">{data.origin}</div>
                </div>
              </div>
            )}

            {/* Role + Period */}
            <div className="space-y-4 flex-1">
              {data.role && <DataRow label="Role" value={data.role} />}
              {data.period && <DataRow label="Historical Period" value={data.period} accent />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-sm leading-snug ${accent ? "text-[#dda15e]" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
