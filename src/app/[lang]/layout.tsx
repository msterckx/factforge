import type { Metadata } from "next";
import { isValidLang, SUPPORTED_LANGS, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Navbar from "@/components/Navbar";
import LayoutWrapper from "@/components/LayoutWrapper";
import LangSync from "@/components/LangSync";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gameoftrivia.com";

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? `/${lang}`;

  const languages: Record<string, string> = { "x-default": `${BASE_URL}${pathname.replace(/^\/[^/]+/, "/en")}` };
  for (const l of SUPPORTED_LANGS) {
    languages[l] = `${BASE_URL}${pathname.replace(/^\/[^/]+/, `/${l}`)}`;
  }

  return { alternates: { languages } };
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  return (
    <>
      <LangSync lang={lang} />
      <Navbar lang={lang as Lang} />
      <LayoutWrapper>{children}</LayoutWrapper>
    </>
  );
}
