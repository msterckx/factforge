import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import GamePicker from "@/components/challenges/GamePicker";
import type { GameEntry } from "@/components/challenges/GamePicker";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function ChallengesPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  const games: GameEntry[] = [
    {
      href: `/${lang}/challenges/twelve-caesars`,
      icon: "🏛️",
      label: d.twelveCaesars,
      subtitle: d.twelveCaesarsSubtitle,
      category: "history",
      gameType: "chronology",
      available: true,
    },
    {
      href: `/${lang}/challenges/conquistadors`,
      icon: "⚔️",
      label: d.conquistadors,
      subtitle: d.conquistadorsSubtitle,
      category: "history",
      gameType: "chronology",
      available: true,
    },
    {
      href: `/${lang}/challenges/quantum-scientists`,
      icon: "🔬",
      label: d.quantumScientists,
      subtitle: d.quantumScientistsSubtitle,
      category: "science",
      gameType: "chronology",
      available: true,
    },
    {
      href: `/${lang}/challenges/olympics`,
      icon: "🏅",
      label: d.olympics,
      subtitle: d.olympicsSubtitle,
      category: "other",
      gameType: "puzzle",
      available: true,
    },
    {
      href: "#",
      icon: "🌍",
      label: "Flag Quiz",
      subtitle: d.comingSoon,
      category: "other",
      gameType: "other",
      available: false,
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{d.title}</h1>
      <p className="text-slate-500 mb-8">{d.subtitle}</p>

      <GamePicker games={games} dict={d} />
    </div>
  );
}
