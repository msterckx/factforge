declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

export function trackChallengeStart(challengeId: string) {
  trackEvent("challenge_start", { challenge_id: challengeId });
}

export function trackChallengeComplete(challengeId: string, score: number, maxScore: number) {
  trackEvent("challenge_complete", {
    challenge_id: challengeId,
    score,
    max_score:    maxScore,
    score_pct:    maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
  });
}

export function trackChallengeFail(challengeId: string) {
  trackEvent("challenge_fail", { challenge_id: challengeId });
}
