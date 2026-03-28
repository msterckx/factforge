export interface ConnectionItem {
  id: number;
  name: string;       // the item to match (e.g. artwork title)
  imageUrl: string;   // optional image of the item
  match: string;      // the correct answer (e.g. artist name)
  description: string; // shown after results are revealed
}
