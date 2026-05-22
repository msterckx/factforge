import type { Metadata } from "next";
import { getDictionary, isValidLang, type Lang } from "@/i18n";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(isValidLang(lang) ? (lang as Lang) : "en");
  return { title: dict.contact.title, description: dict.contact.subtitle };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
