export interface ChronologyItem {
  id: number;    // 1-based correct position
  name: string;
  reign: string; // dates (reign, lifetime, exploration period, etc.)
  fact: string;
  imageUrl: string;
  description: string;
  milestone: string;
}
