import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mapRegions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** All African countries keyed to the SVG path IDs in /public/maps/africa.svg */
const AFRICA_DEFAULTS = [
  { regionKey: "MA", labelEn: "Morocco",                        labelNl: "Marokko",                       capitalEn: "Rabat",          capitalNl: "Rabat" },
  { regionKey: "EH", labelEn: "Western Sahara",                 labelNl: "Westelijke Sahara",             capitalEn: null,             capitalNl: null },
  { regionKey: "DZ", labelEn: "Algeria",                        labelNl: "Algerije",                      capitalEn: "Algiers",        capitalNl: "Algiers" },
  { regionKey: "TN", labelEn: "Tunisia",                        labelNl: "Tunesië",                       capitalEn: "Tunis",          capitalNl: "Tunis" },
  { regionKey: "LY", labelEn: "Libya",                          labelNl: "Libië",                         capitalEn: "Tripoli",        capitalNl: "Tripoli" },
  { regionKey: "EG", labelEn: "Egypt",                          labelNl: "Egypte",                        capitalEn: "Cairo",          capitalNl: "Caïro" },
  { regionKey: "MR", labelEn: "Mauritania",                     labelNl: "Mauritanië",                    capitalEn: "Nouakchott",     capitalNl: "Nouakchott" },
  { regionKey: "SN", labelEn: "Senegal",                        labelNl: "Senegal",                       capitalEn: "Dakar",          capitalNl: "Dakar" },
  { regionKey: "GM", labelEn: "Gambia",                         labelNl: "Gambia",                        capitalEn: "Banjul",         capitalNl: "Banjul" },
  { regionKey: "GW", labelEn: "Guinea-Bissau",                  labelNl: "Guinee-Bissau",                 capitalEn: "Bissau",         capitalNl: "Bissau" },
  { regionKey: "GN", labelEn: "Guinea",                         labelNl: "Guinee",                        capitalEn: "Conakry",        capitalNl: "Conakry" },
  { regionKey: "SL", labelEn: "Sierra Leone",                   labelNl: "Sierra Leone",                  capitalEn: "Freetown",       capitalNl: "Freetown" },
  { regionKey: "LR", labelEn: "Liberia",                        labelNl: "Liberia",                       capitalEn: "Monrovia",       capitalNl: "Monrovia" },
  { regionKey: "CI", labelEn: "Ivory Coast",                    labelNl: "Ivoorkust",                     capitalEn: "Yamoussoukro",   capitalNl: "Yamoussoukro" },
  { regionKey: "GH", labelEn: "Ghana",                          labelNl: "Ghana",                         capitalEn: "Accra",          capitalNl: "Accra" },
  { regionKey: "TG", labelEn: "Togo",                           labelNl: "Togo",                          capitalEn: "Lomé",           capitalNl: "Lomé" },
  { regionKey: "BJ", labelEn: "Benin",                          labelNl: "Benin",                         capitalEn: "Porto-Novo",     capitalNl: "Porto-Novo" },
  { regionKey: "NG", labelEn: "Nigeria",                        labelNl: "Nigeria",                       capitalEn: "Abuja",          capitalNl: "Abuja" },
  { regionKey: "ML", labelEn: "Mali",                           labelNl: "Mali",                          capitalEn: "Bamako",         capitalNl: "Bamako" },
  { regionKey: "BF", labelEn: "Burkina Faso",                   labelNl: "Burkina Faso",                  capitalEn: "Ouagadougou",    capitalNl: "Ouagadougou" },
  { regionKey: "NE", labelEn: "Niger",                          labelNl: "Niger",                         capitalEn: "Niamey",         capitalNl: "Niamey" },
  { regionKey: "TD", labelEn: "Chad",                           labelNl: "Tsjaad",                        capitalEn: "N'Djamena",      capitalNl: "N'Djamena" },
  { regionKey: "SD", labelEn: "Sudan",                          labelNl: "Soedan",                        capitalEn: "Khartoum",       capitalNl: "Khartoem" },
  { regionKey: "SS", labelEn: "South Sudan",                    labelNl: "Zuid-Soedan",                   capitalEn: "Juba",           capitalNl: "Juba" },
  { regionKey: "ER", labelEn: "Eritrea",                        labelNl: "Eritrea",                       capitalEn: "Asmara",         capitalNl: "Asmara" },
  { regionKey: "ET", labelEn: "Ethiopia",                       labelNl: "Ethiopië",                      capitalEn: "Addis Ababa",    capitalNl: "Addis Abeba" },
  { regionKey: "DJ", labelEn: "Djibouti",                       labelNl: "Djibouti",                      capitalEn: "Djibouti",       capitalNl: "Djibouti" },
  { regionKey: "SO", labelEn: "Somalia",                        labelNl: "Somalië",                       capitalEn: "Mogadishu",      capitalNl: "Mogadishu" },
  { regionKey: "GQ", labelEn: "Equatorial Guinea",              labelNl: "Equatoriaal-Guinea",            capitalEn: "Malabo",         capitalNl: "Malabo" },
  { regionKey: "CM", labelEn: "Cameroon",                       labelNl: "Kameroen",                      capitalEn: "Yaoundé",        capitalNl: "Yaoundé" },
  { regionKey: "CF", labelEn: "Central African Republic",       labelNl: "Centraal-Afrikaanse Republiek", capitalEn: "Bangui",         capitalNl: "Bangui" },
  { regionKey: "GA", labelEn: "Gabon",                          labelNl: "Gabon",                         capitalEn: "Libreville",     capitalNl: "Libreville" },
  { regionKey: "CG", labelEn: "Republic of the Congo",          labelNl: "Republiek Congo",               capitalEn: "Brazzaville",    capitalNl: "Brazzaville" },
  { regionKey: "CD", labelEn: "DR Congo",                       labelNl: "DR Congo",                      capitalEn: "Kinshasa",       capitalNl: "Kinshasa" },
  { regionKey: "UG", labelEn: "Uganda",                         labelNl: "Oeganda",                       capitalEn: "Kampala",        capitalNl: "Kampala" },
  { regionKey: "KE", labelEn: "Kenya",                          labelNl: "Kenia",                         capitalEn: "Nairobi",        capitalNl: "Nairobi" },
  { regionKey: "RW", labelEn: "Rwanda",                         labelNl: "Rwanda",                        capitalEn: "Kigali",         capitalNl: "Kigali" },
  { regionKey: "BI", labelEn: "Burundi",                        labelNl: "Burundi",                       capitalEn: "Gitega",         capitalNl: "Gitega" },
  { regionKey: "TZ", labelEn: "Tanzania",                       labelNl: "Tanzania",                      capitalEn: "Dodoma",         capitalNl: "Dodoma" },
  { regionKey: "MW", labelEn: "Malawi",                         labelNl: "Malawi",                        capitalEn: "Lilongwe",       capitalNl: "Lilongwe" },
  { regionKey: "AO", labelEn: "Angola",                         labelNl: "Angola",                        capitalEn: "Luanda",         capitalNl: "Luanda" },
  { regionKey: "ZM", labelEn: "Zambia",                         labelNl: "Zambia",                        capitalEn: "Lusaka",         capitalNl: "Lusaka" },
  { regionKey: "MZ", labelEn: "Mozambique",                     labelNl: "Mozambique",                    capitalEn: "Maputo",         capitalNl: "Maputo" },
  { regionKey: "ZW", labelEn: "Zimbabwe",                       labelNl: "Zimbabwe",                      capitalEn: "Harare",         capitalNl: "Harare" },
  { regionKey: "BW", labelEn: "Botswana",                       labelNl: "Botswana",                      capitalEn: "Gaborone",       capitalNl: "Gaborone" },
  { regionKey: "NA", labelEn: "Namibia",                        labelNl: "Namibië",                       capitalEn: "Windhoek",       capitalNl: "Windhoek" },
  { regionKey: "ZA", labelEn: "South Africa",                   labelNl: "Zuid-Afrika",                   capitalEn: "Pretoria",       capitalNl: "Pretoria" },
  { regionKey: "LS", labelEn: "Lesotho",                        labelNl: "Lesotho",                       capitalEn: "Maseru",         capitalNl: "Maseru" },
  { regionKey: "SZ", labelEn: "Eswatini",                       labelNl: "Eswatini",                      capitalEn: "Mbabane",        capitalNl: "Mbabane" },
  { regionKey: "MG", labelEn: "Madagascar",                     labelNl: "Madagaskar",                    capitalEn: "Antananarivo",   capitalNl: "Antananarivo" },
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await req.json() as { gameId?: number };
  if (!gameId || isNaN(gameId)) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  db.delete(mapRegions).where(eq(mapRegions.gameId, gameId)).run();
  db.insert(mapRegions).values(AFRICA_DEFAULTS.map((r) => ({ ...r, gameId }))).run();

  return NextResponse.json({ ok: true, inserted: AFRICA_DEFAULTS.length });
}
