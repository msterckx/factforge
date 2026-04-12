import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** All countries/territories keyed to the SVG path IDs in /public/maps/south_america.svg */
const SA_DEFAULTS = [
  { regionKey: "AR", labelEn: "Argentina",                         labelNl: "Argentinië",                    capitalEn: "Buenos Aires",   capitalNl: "Buenos Aires" },
  { regionKey: "BO", labelEn: "Bolivia",                           labelNl: "Bolivia",                       capitalEn: "Sucre",          capitalNl: "Sucre" },
  { regionKey: "BR", labelEn: "Brazil",                            labelNl: "Brazilië",                      capitalEn: "Brasília",       capitalNl: "Brasília" },
  { regionKey: "CL", labelEn: "Chile",                             labelNl: "Chili",                         capitalEn: "Santiago",       capitalNl: "Santiago" },
  { regionKey: "CO", labelEn: "Colombia",                          labelNl: "Colombia",                      capitalEn: "Bogotá",         capitalNl: "Bogotá" },
  { regionKey: "EC", labelEn: "Ecuador",                           labelNl: "Ecuador",                       capitalEn: "Quito",          capitalNl: "Quito" },
  { regionKey: "GF", labelEn: "French Guiana",                     labelNl: "Frans-Guyana",                  capitalEn: "Cayenne",        capitalNl: "Cayenne" },
  { regionKey: "GY", labelEn: "Guyana",                            labelNl: "Guyana",                        capitalEn: "Georgetown",     capitalNl: "Georgetown" },
  { regionKey: "PE", labelEn: "Peru",                              labelNl: "Peru",                          capitalEn: "Lima",           capitalNl: "Lima" },
  { regionKey: "PY", labelEn: "Paraguay",                          labelNl: "Paraguay",                      capitalEn: "Asunción",       capitalNl: "Asunción" },
  { regionKey: "SR", labelEn: "Suriname",                          labelNl: "Suriname",                      capitalEn: "Paramaribo",     capitalNl: "Paramaribo" },
  { regionKey: "TT", labelEn: "Trinidad and Tobago",               labelNl: "Trinidad en Tobago",            capitalEn: "Port of Spain",  capitalNl: "Port of Spain" },
  { regionKey: "UY", labelEn: "Uruguay",                           labelNl: "Uruguay",                       capitalEn: "Montevideo",     capitalNl: "Montevideo" },
  { regionKey: "VE", labelEn: "Venezuela",                         labelNl: "Venezuela",                     capitalEn: "Caracas",        capitalNl: "Caracas" },
  { regionKey: "AW", labelEn: "Aruba",                             labelNl: "Aruba",                         capitalEn: "Oranjestad",     capitalNl: "Oranjestad" },
  { regionKey: "BQ", labelEn: "Caribbean Netherlands",             labelNl: "Caribisch Nederland",           capitalEn: "Kralendijk",     capitalNl: "Kralendijk" },
  { regionKey: "CW", labelEn: "Curaçao",                           labelNl: "Curaçao",                       capitalEn: "Willemstad",     capitalNl: "Willemstad" },
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await req.json() as { gameId?: number };
  if (!gameId || isNaN(gameId)) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  db.delete(mapRegions).where(eq(mapRegions.gameId, gameId)).run();
  db.insert(mapRegions).values(SA_DEFAULTS.map((r) => ({ ...r, gameId }))).run();

  return NextResponse.json({ ok: true, inserted: SA_DEFAULTS.length });
}
