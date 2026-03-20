export interface ChronologyItem {
  id: number;    // 1-based correct position
  name: string;
  reign: string; // dates (reign, lifetime, exploration period, etc.)
  fact?: string; // kept optional for static data files; not used in DB-backed items
  imageUrl: string;
  description: string;
  milestone?: string;
}
