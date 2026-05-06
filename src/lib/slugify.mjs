export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')          // strip combining marks
    .toLowerCase()
    .replace(/[''']/g, '')          // drop ASCII + smart apostrophes
    .replace(/[^a-z0-9]+/g, '-')              // non-alphanum → dash
    .replace(/^-+|-+$/g, '');                 // trim leading/trailing dashes
}

export function slugifyWork(title, theYear) {
  const firstYear = String(theYear).match(/\d{4}/)?.[0] ?? 'unknown';
  return `${slugify(title)}-${firstYear}`;
}
