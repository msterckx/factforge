import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConquistadors } from "@/data/conquistadors";
import ChronologyGame from "@/components/challenges/ChronologyGame";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function ConquistadorsPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const dict = await getDictionary(lang as Lang);
  const d = dict.challenges;

  return (
    <div>
      <Link
        href={`/${lang}/challenges`}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        &larr; {d.backToChallenges}
      </Link>

      <h1 className="text-2xl font-bold text-slate-800 mb-1">{d.conquistadors}</h1>
      <p className="text-slate-500 text-sm mb-6">{d.conquistadorsSubtitle}</p>

      <ChronologyGame items={getConquistadors(lang)} dict={d} />
    </div>
  );
}
