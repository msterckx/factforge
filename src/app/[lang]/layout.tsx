import { isValidLang, type Lang } from "@/i18n";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import LayoutWrapper from "@/components/LayoutWrapper";
import LangSync from "@/components/LangSync";

interface Props {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
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
