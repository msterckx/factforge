"use client";

import InfographPanel, { type InfographData, type InfographField } from "./InfographPanel";
import type { MapRegion } from "@/data/challengeGame";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: Record<string, any>, extraText?: string): InfographData {
  // Already in new flexible format
  if (Array.isArray(raw.fields)) {
    return { ...raw, description: raw.description ?? extraText } as InfographData;
  }

  // Legacy ParkInfographData → new format
  const fields: InfographField[] = [];
  if (raw.area)        fields.push({ label: "Area",        value: raw.area,        barPct: raw.areaBarPct });
  if (raw.established) fields.push({ label: "Established", value: raw.established });
  if (raw.landscape)   fields.push({ label: "Landscape",   value: raw.landscape   });
  if (raw.wildlife)    fields.push({ label: "Wildlife",    value: raw.wildlife    });

  return {
    countryIso2:  raw.countryIso2,
    country:      raw.country,
    typeLabel:    "National Park",
    fields,
    images:       raw.images ?? [],
    description:  extraText,
  };
}

interface Props {
  region:    MapRegion;
  lang:      string;
  onDismiss: () => void;
}

export default function ParkInfographPanel({ region, lang, onDismiss }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw  = JSON.parse(region.infographData!) as Record<string, any>;
  const name = lang === "nl" ? region.labelNl : region.labelEn;
  const text = lang === "nl" ? (region.infoTextNl ?? region.infoTextEn) : region.infoTextEn;
  return <InfographPanel name={name} data={normalize(raw, text ?? undefined)} onDismiss={onDismiss} />;
}
