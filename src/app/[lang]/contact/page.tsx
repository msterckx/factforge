"use client";

import { useState, useTransition } from "react";
import { sendContactEmail } from "@/actions/contact";
import { getDictionary, isValidLang, type Lang } from "@/i18n";
import { use } from "react";
import type { Dictionary } from "@/i18n/en";

interface Props {
  params: Promise<{ lang: string }>;
}

export default function ContactPage({ params }: Props) {
  const { lang } = use(params);
  const dict = use(getDictionary(isValidLang(lang) ? (lang as Lang) : "en")) as Dictionary;

  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await sendContactEmail(formData);
      setStatus(result.success ? "success" : "error");
    });
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{dict.contact.title}</h1>
      <p className="text-slate-500 mb-8">{dict.contact.subtitle}</p>

      {status === "success" ? (
        <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-green-800 font-semibold text-lg mb-1">{dict.contact.successTitle}</p>
          <p className="text-green-700 text-sm">{dict.contact.successMessage}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          {status === "error" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {dict.contact.errorMessage}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{dict.contact.name}</label>
            <input
              name="name"
              type="text"
              required
              placeholder={dict.contact.namePlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{dict.contact.email}</label>
            <input
              name="email"
              type="email"
              required
              placeholder={dict.contact.emailPlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{dict.contact.message}</label>
            <textarea
              name="message"
              required
              rows={5}
              placeholder={dict.contact.messagePlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-vertical"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {isPending ? dict.contact.sending : dict.contact.send}
          </button>
        </form>
      )}
    </div>
  );
}
