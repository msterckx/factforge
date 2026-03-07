import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function ChallengesPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{d.title}</h1>
      <p className="text-slate-500 mb-8">{d.subtitle}</p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <p className="text-slate-600">{d.pickGame}</p>
      </div>

      {/* Mobile-only game list (sidebar hidden on mobile) */}
      <div className="md:hidden">
        <Link
          href={`/${lang}/challenges/guess-the-person`}
          className="flex items-center gap-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 border border-slate-200 hover:border-amber-400 group"
        >
          <span className="text-3xl">🕵️</span>
          <div>
            <p className="font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">
              {d.guessThePerson}
            </p>
            <p className="text-sm text-slate-400">{d.guessThePersonSubtitle}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
