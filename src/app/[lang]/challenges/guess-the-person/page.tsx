import { isValidLang, getDictionary, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import { famousPersons } from "@/data/famousPersons";
import GuessThePersonGame from "@/components/challenges/GuessThePersonGame";

interface Props {
  params: Promise<{ lang: string }>;
}

export default async function GuessThePersonPage({ params }: Props) {
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

      <h1 className="text-2xl font-bold text-slate-800 mb-1">{d.guessThePerson}</h1>
      <p className="text-slate-500 text-sm mb-6">{d.guessThePersonSubtitle}</p>

      <GuessThePersonGame persons={famousPersons} dict={d} />
    </div>
  );
}
