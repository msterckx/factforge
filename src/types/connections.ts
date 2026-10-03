export interface ConnectionItem {
  id: number;
  name: string;       // the item to match (e.g. artwork title)
  imageUrl: string;   // optional image of the item
  images?: string[];  // additional carousel images (imageUrl is shown first)
  match: string;      // the correct answer (e.g. artist name)
  description: string; // shown after results are revealed
}
