"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "ff_completed_challenges";

export interface CompletionRecord {
  completedAt: string;
  score: number;
  maxScore: number;
}

export type CompletedMap = Record<string, CompletionRecord | undefined>;

export function useCompletedChallenges() {
  const [completed, setCompleted] = useState<CompletedMap>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCompleted(JSON.parse(raw));
    } catch {
      // ignore parse errors
    }
  }, []);

  const markComplete = useCallback((challengeId: string, score: number, maxScore: number) => {
    setCompleted((prev) => {
      const existing = prev[challengeId];
      // Only update if new score is better (or first time)
      if (existing && existing.score >= score) return prev;
      const next: CompletedMap = {
        ...prev,
        [challengeId]: { completedAt: new Date().toISOString(), score, maxScore },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { completed, markComplete };
}
