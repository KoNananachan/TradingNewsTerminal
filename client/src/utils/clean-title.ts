/** Strip time prefixes, "Read More" suffixes, and leaked sentiment words from scraped titles */
export function cleanTitle(title: string) {
  return title
    .replace(/^(?:Latest)?\d{1,2}:\d{2}/, '')
    .replace(/Read More.*$/, '')
    .replace(/(?:bullish|bearish|neutral)/gi, '')
    .trim();
}
