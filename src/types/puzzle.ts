export interface PuzzleSubject {
  id: number;
  name: string;        // hidden during play, revealed on solve
  hint: string;        // shown when player clicks "Hint" (e.g. sport or discipline)
  achievement: string; // short achievement line shown in the reveal panel
  imageUrl: string;    // square-ish portrait recommended (min 300×300 px)
  description: string;
}
