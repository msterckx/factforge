"use client";

export default function StartChallengeButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => {
        const el = document.getElementById("challenge-game");
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }}
      className="inline-block mb-6 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}
