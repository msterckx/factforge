/**
 * k6 Load Test — Game of Trivia: Quiz User Simulation
 *
 * Simulates real users browsing the home page and taking a category quiz.
 * Since the quiz is server-side rendered (all questions load in one page
 * request, answer checking is client-side), this script tests:
 *   1. Home page load
 *   2. Category quiz page load
 *   3. Think time per question (configurable)
 *
 * Usage:
 *   k6 run quiz-load-test.js
 *
 * Configurable via environment variables:
 *   BASE_URL         — target URL            (default: http://localhost:3000)
 *   VUS              — concurrent users       (default: 10)
 *   DURATION         — test duration          (default: 5m)
 *   LANG             — language prefix        (default: en)
 *   CATEGORY         — quiz category slug     (default: random per VU)
 *   QUESTIONS        — questions per session  (default: 10)
 *   THINK_TIME       — seconds between q's   (default: 10)
 *   THINK_JITTER     — randomness ±seconds   (default: 5)
 *
 * Examples:
 *   k6 run -e VUS=50 -e DURATION=10m quiz-load-test.js
 *   k6 run -e VUS=20 -e DURATION=5m -e CATEGORY=science -e THINK_TIME=8 quiz-load-test.js
 *   k6 run -e BASE_URL=https://yourdomain.com -e VUS=100 -e DURATION=15m quiz-load-test.js
 */

import http from "k6/http";
import { sleep, check, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LANG = __ENV.LANG || "en";
const QUESTIONS = parseInt(__ENV.QUESTIONS || "10", 10);
const THINK_TIME = parseFloat(__ENV.THINK_TIME || "10"); // seconds between questions
const THINK_JITTER = parseFloat(__ENV.THINK_JITTER || "5"); // ± random seconds

/** All available quiz categories. Override with CATEGORY env var to pin one. */
const ALL_CATEGORIES = ["geography", "history", "television", "science", "sports"];

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  vus: parseInt(__ENV.VUS || "10", 10),
  duration: __ENV.DURATION || "5m",

  thresholds: {
    // 95th percentile page load under 3 seconds
    http_req_duration: ["p(95)<3000"],
    // Less than 5% error rate
    http_req_failed: ["rate<0.05"],
    // Home page p95 under 2 seconds
    "home_page_duration{page:home}": ["p(95)<2000"],
    // Category quiz page p95 under 3 seconds (heavier — loads all questions)
    "quiz_page_duration{page:quiz}": ["p(95)<3000"],
  },
};

// ---------------------------------------------------------------------------
// Custom Metrics
// ---------------------------------------------------------------------------

const homePageDuration = new Trend("home_page_duration", true);
const quizPageDuration = new Trend("quiz_page_duration", true);
const quizSessionsCompleted = new Counter("quiz_sessions_completed");
const quizSessionErrors = new Rate("quiz_session_errors");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a random float between min and max. */
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** Returns a random integer between min and max (inclusive). */
function randInt(min, max) {
  return Math.floor(randBetween(min, max + 1));
}

/** Think time with jitter — simulates human reading/answering pace. */
function thinkTime() {
  const t = Math.max(1, randBetween(THINK_TIME - THINK_JITTER, THINK_TIME + THINK_JITTER));
  sleep(t);
}

/** Pick a category for this VU: pinned via env var, or random per session. */
function pickCategory() {
  if (__ENV.CATEGORY) return __ENV.CATEGORY;
  return ALL_CATEGORIES[randInt(0, ALL_CATEGORIES.length - 1)];
}

/** Common request params — headers that a real browser would send. */
const requestParams = {
  headers: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": LANG === "nl" ? "nl,en;q=0.5" : "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
};

// ---------------------------------------------------------------------------
// Scenario: Single user quiz session
// ---------------------------------------------------------------------------

export default function () {
  let sessionFailed = false;

  // ── Step 1: Land on home page ────────────────────────────────────────────
  group("home_page", () => {
    const res = http.get(`${BASE_URL}/${LANG}`, requestParams);

    const ok = check(res, {
      "home: status 200": (r) => r.status === 200,
      "home: has content": (r) => r.body && r.body.length > 0,
      "home: contains quiz links": (r) =>
        r.body.includes("category") || r.body.includes("quiz") || r.body.includes("trivia"),
    });

    homePageDuration.add(res.timings.duration, { page: "home" });

    if (!ok) sessionFailed = true;
  });

  if (sessionFailed) {
    quizSessionErrors.add(1);
    return;
  }

  // Short pause — user reads the home page before choosing a category
  sleep(randBetween(1, 3));

  // ── Step 2: Navigate to a category quiz page ─────────────────────────────
  const category = pickCategory();

  group("quiz_page", () => {
    const res = http.get(
      `${BASE_URL}/${LANG}/category/${category}`,
      requestParams
    );

    const ok = check(res, {
      "quiz: status 200": (r) => r.status === 200,
      "quiz: has content": (r) => r.body && r.body.length > 0,
      "quiz: contains questions": (r) =>
        r.body.includes("question") ||
        r.body.includes("answer") ||
        r.body.includes("quiz"),
    });

    quizPageDuration.add(res.timings.duration, { page: "quiz" });

    if (!ok) sessionFailed = true;
  });

  if (sessionFailed) {
    quizSessionErrors.add(1);
    return;
  }

  // ── Step 3: Simulate going through N questions ───────────────────────────
  // All questions are loaded in the initial page render. Each "question" is
  // a client-side interaction, so we just sleep to simulate the user thinking,
  // reading the question, and typing an answer before moving on.
  group("quiz_session", () => {
    for (let q = 1; q <= QUESTIONS; q++) {
      // Simulate reading the question + typing an answer
      thinkTime();

      // Optional: every few questions, re-fetch the page to simulate a user
      // refreshing or navigating away and back (e.g. browser back button).
      // This adds some realistic re-load traffic. Disable by removing this block.
      if (q % 5 === 0) {
        const refresh = http.get(
          `${BASE_URL}/${LANG}/category/${category}`,
          requestParams
        );
        check(refresh, {
          "quiz refresh: status 200": (r) => r.status === 200,
        });
        quizPageDuration.add(refresh.timings.duration, { page: "quiz" });
      }
    }
  });

  quizSessionsCompleted.add(1);
  quizSessionErrors.add(0);

  // Small cooldown between sessions (user might stay on site or leave)
  sleep(randBetween(1, 5));
}
