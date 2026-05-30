"use client";

import { useState } from "react";

export interface InfographAdminField {
  label:  string;
  value:  string;
  barPct: string;   // empty = no bar; stored as string for the input
  accent: boolean;
}

export interface InfographAdminState {
  countryIso2: string;
  country:     string;
  typeLabel:   string;
  fields:      InfographAdminField[];
  images:      string; // newline-separated URLs
  description: string;
}

export const EMPTY_INFOGRAPH_ADMIN: InfographAdminState = {
  countryIso2: "", country: "", typeLabel: "",
  fields: [], images: "", description: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseInfographAdmin(raw: string | null | undefined): InfographAdminState {
  if (!raw) return { ...EMPTY_INFOGRAPH_ADMIN, fields: [] };
  try {
    const d = JSON.parse(raw);

    // New flexible format (has fields array)
    if (Array.isArray(d.fields)) {
      return {
        countryIso2: d.countryIso2 ?? "",
        country:     d.country     ?? "",
        typeLabel:   d.typeLabel   ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields: d.fields.map((f: any) => ({
          label:  f.label  ?? "",
          value:  f.value  ?? "",
          barPct: f.barPct != null ? String(f.barPct) : "",
          accent: !!f.accent,
        })),
        images:      Array.isArray(d.images) ? d.images.join("\n") : "",
        description: d.description ?? "",
      };
    }

    // Legacy PersonInfographData: born, died, origin, role, period, description, images
    if (d.born !== undefined || d.role !== undefined || d.origin !== undefined) {
      const fields: InfographAdminField[] = [];
      if (d.born)   fields.push({ label: "Born",             value: d.born,   barPct: "", accent: false });
      if (d.died)   fields.push({ label: "Died",             value: d.died,   barPct: "", accent: false });
      if (d.role)   fields.push({ label: "Role",             value: d.role,   barPct: "", accent: false });
      if (d.period) fields.push({ label: "Historical Period", value: d.period, barPct: "", accent: true  });
      return {
        countryIso2: "",
        country:     d.origin ?? "",
        typeLabel:   d.period ?? "",
        fields,
        images:      Array.isArray(d.images) ? d.images.join("\n") : "",
        description: d.description ?? "",
      };
    }

    // Legacy ParkInfographData: countryIso2, country, area, areaBarPct, established, landscape, wildlife, images
    const fields: InfographAdminField[] = [];
    if (d.area)        fields.push({ label: "Area",        value: d.area,        barPct: d.areaBarPct != null ? String(d.areaBarPct) : "", accent: false });
    if (d.established) fields.push({ label: "Established", value: d.established, barPct: "", accent: false });
    if (d.landscape)   fields.push({ label: "Landscape",   value: d.landscape,   barPct: "", accent: false });
    if (d.wildlife)    fields.push({ label: "Wildlife",    value: d.wildlife,    barPct: "", accent: false });
    return {
      countryIso2: d.countryIso2 ?? "",
      country:     d.country     ?? "",
      typeLabel:   "",
      fields,
      images:      Array.isArray(d.images) ? d.images.join("\n") : "",
      description: "",
    };
  } catch { return { ...EMPTY_INFOGRAPH_ADMIN, fields: [] }; }
}

export function serializeInfographAdmin(s: InfographAdminState): string | null {
  const images = s.images.split("\n").map((x) => x.trim()).filter(Boolean);
  const fields = s.fields
    .filter((f) => f.label.trim() && f.value.trim())
    .map((f) => ({
      label:  f.label,
      value:  f.value,
      ...(f.barPct.trim() ? { barPct: Number(f.barPct) } : {}),
      ...(f.accent        ? { accent: true }             : {}),
    }));
  const hasData = s.countryIso2 || s.country || s.typeLabel || fields.length || images.length || s.description;
  if (!hasData) return null;
  return JSON.stringify({
    ...(s.countryIso2 ? { countryIso2: s.countryIso2 } : {}),
    ...(s.country     ? { country:     s.country     } : {}),
    ...(s.typeLabel   ? { typeLabel:   s.typeLabel   } : {}),
    fields,
    images,
    ...(s.description ? { description: s.description } : {}),
  });
}

const inp = "w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white";

interface Props {
  value:    InfographAdminState;
  onChange: (v: InfographAdminState) => void;
}

export default function InfographAdminEditor({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function set<K extends keyof InfographAdminState>(key: K, val: InfographAdminState[K]) {
    onChange({ ...value, [key]: val });
  }

  function setField(idx: number, key: keyof InfographAdminField, val: string | boolean) {
    const fields = [...value.fields];
    fields[idx] = { ...fields[idx], [key]: val };
    onChange({ ...value, fields });
  }

  function addField() {
    onChange({ ...value, fields: [...value.fields, { label: "", value: "", barPct: "", accent: false }] });
  }

  function removeField(idx: number) {
    onChange({ ...value, fields: value.fields.filter((_, i) => i !== idx) });
  }

  const hasData =
    value.countryIso2 || value.country || value.typeLabel ||
    value.fields.some((f) => f.label || f.value) ||
    value.images || value.description;

  return (
    <div className="col-span-2 border border-indigo-200 rounded bg-indigo-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
      >
        <span>Infograph data {hasData ? <span className="text-indigo-400">✓</span> : ""}</span>
        <span className="text-indigo-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">

          {/* Country (fixed) */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">Country ISO-2 (e.g. DE)</label>
              <input className={inp} placeholder="DE" value={value.countryIso2} onChange={(e) => set("countryIso2", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">Country name</label>
              <input className={inp} placeholder="Germany" value={value.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>

          {/* Variable fields */}
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Key info fields
              <span className="ml-1 font-normal text-slate-400">(Label · Value · Bar% · ★ accent — first ★ field becomes the top label)</span>
            </div>
            <div className="space-y-1.5">
              {value.fields.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    className={`${inp} w-32 flex-shrink-0`}
                    placeholder="Label"
                    value={f.label}
                    onChange={(e) => setField(i, "label", e.target.value)}
                  />
                  <input
                    className={`${inp} flex-1 min-w-0`}
                    placeholder="Value"
                    value={f.value}
                    onChange={(e) => setField(i, "value", e.target.value)}
                  />
                  <input
                    className={`${inp} w-14 flex-shrink-0`}
                    placeholder="Bar%"
                    type="number"
                    min="0"
                    max="100"
                    value={f.barPct}
                    onChange={(e) => setField(i, "barPct", e.target.value)}
                  />
                  <label className="flex items-center gap-0.5 text-xs text-slate-500 flex-shrink-0 cursor-pointer" title="Accent colour">
                    <input
                      type="checkbox"
                      checked={f.accent}
                      onChange={(e) => setField(i, "accent", e.target.checked)}
                      className="w-3 h-3"
                    />
                    ★
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="text-red-400 hover:text-red-600 text-base leading-none flex-shrink-0"
                    title="Remove field"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addField}
              className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add field
            </button>
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">Images (one URL per line)</label>
            <textarea
              rows={3}
              className={`${inp} font-mono resize-y`}
              placeholder={"https://…\nhttps://…"}
              value={value.images}
              onChange={(e) => set("images", e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">Description (optional)</label>
            <textarea
              rows={3}
              className={`${inp} resize-y`}
              placeholder="A few sentences…"
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
