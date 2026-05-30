"use client";

import InfographPanel, { type InfographData, type InfographField } from "./InfographPanel";

// Legacy type — kept so existing callers (MatchingGame, ChronologyGame) don't need updating.
export interface PersonInfographData {
  born?:            string;
  died?:            string;
  origin?:          string;
  originCountryId?: number;
  role?:            string;
  period?:          string;
  description?:     string;
  ghostText?:       string;
  caption?:         string;
  images?:          string[];
  // New flexible format fields (pass-through)
  countryIso2?:     string;
  country?:         string;
  typeLabel?:       string;
  fields?:          InfographField[];
}

function normalize(data: PersonInfographData): InfographData {
  // Already in new flexible format
  if (Array.isArray(data.fields)) {
    return data as InfographData;
  }

  // Legacy format → new format
  const fields: InfographField[] = [];
  if (data.born)   fields.push({ label: "Born",             value: data.born });
  if (data.died)   fields.push({ label: "Died",             value: data.died });
  if (data.role)   fields.push({ label: "Role",             value: data.role });
  if (data.period) fields.push({ label: "Historical Period", value: data.period, accent: true });

  return {
    countryIso2: data.countryIso2,
    country:     data.country ?? data.origin,
    typeLabel:   data.typeLabel ?? data.period,
    fields,
    images:      data.images ?? [],
    description: data.description,
  };
}

interface Props {
  name:      string;
  data:      PersonInfographData;
  onDismiss: () => void;
}

export default function PersonInfographPanel({ name, data, onDismiss }: Props) {
  return <InfographPanel name={name} data={normalize(data)} onDismiss={onDismiss} />;
}
