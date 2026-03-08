import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function ChallengesLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  const games = [
    {
      href: `/${lang}/challenges/guess-the-person`,
      icon: "🕵️",
      label: d.guessThePerson,
      subtitle: d.guessThePersonSubtitle,
      available: true,
    },
    {
      href: `/${lang}/challenges/twelve-caesars`,
      icon: "🏛️",
      label: d.twelveCaesars,
      subtitle: d.twelveCaesarsSubtitle,
      available: true,
    },
    {
      href: `/${lang}/challenges/conquistadors`,
      icon: "⚔️",
      label: d.conquistadors,
      subtitle: d.conquistadorsSubtitle,
      available: true,
    },
    {
      href: "#",
      icon: "🌍",
      label: "Flag Quiz",
      subtitle: d.comingSoon,
      available: false,
    },
  ];

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Right game picker */}
      <aside className="w-52 shrink-0 hidden md:block">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 sticky top-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {d.gamesTitle}
          </h2>
          <div className="flex flex-col gap-2">
            {games.map((game) =>
              game.available ? (
                <Link
                  key={game.label}
                  href={game.href}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
                >
                  <span className="text-2xl shrink-0 mt-0.5">{game.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-amber-700 leading-tight">
                      {game.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{game.subtitle}</p>
                  </div>
                </Link>
              ) : (
                <div
                  key={game.label}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 opacity-60"
                >
                  <span className="text-2xl shrink-0 mt-0.5 grayscale">{game.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500 leading-tight">{game.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{game.subtitle}</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
