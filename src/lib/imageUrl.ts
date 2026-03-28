/**
 * Converts Wikipedia media-viewer URLs to direct Wikimedia Commons image URLs.
 *
 * Wikipedia media viewer URLs look like:
 *   https://nl.wikipedia.org/wiki/De_school_van_Athene#/media/Bestand:Foo.jpg
 *   https://en.wikipedia.org/wiki/Painting#/media/File:Foo.jpg
 *
 * The fragment (#/media/...) is never sent to the server, so using these
 * directly as <img src> fetches the HTML page instead of the image.
 *
 * This function rewrites them to the Wikimedia Commons Special:FilePath URL
 * which is a direct redirect to the actual image file.
 */
export function resolveImageUrl(url: string): string {
  if (!url) return url;

  // Match any Wikipedia URL with a #/media/<Namespace>:<Filename> fragment
  const match = url.match(/#\/media\/[^:]+:(.+)$/);
  if (match) {
    const filename = match[1]; // already URL-encoded from the original URL
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;
  }

  return url;
}
