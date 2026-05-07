import folio from '../data/folio.json';

export type Medium = 'painting' | 'paper' | 'sculpture' | 'boxes' | 'installation';

export interface Work {
  id: number;
  slug: string;
  title: string;
  year: string;
  decade: number;
  medium: Medium;
  description: string;
  dimensions: string;
  image_root: string;
  image2_root: string | null;
  small: { width: number; height: number };
  large: { width: number; height: number };
  available: boolean;
}

const ALL: Work[] = folio as Work[];

export function getAllWorks(): Work[] {
  return ALL;
}

export function getWorkBySlug(slug: string): Work | undefined {
  return ALL.find((w) => w.slug === slug);
}

export function getAdjacentWorks(slug: string): { prev?: Work; next?: Work } {
  const sorted = sortChronological(ALL);
  const idx = sorted.findIndex((w) => w.slug === slug);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}

export function getRelatedWorks(work: Work, limit = 4): Work[] {
  // Same decade, same medium first; fall back to same medium, any decade.
  const sameBoth = ALL.filter(
    (w) => w.id !== work.id && w.medium === work.medium && w.decade === work.decade
  );
  const sameMedium = ALL.filter(
    (w) => w.id !== work.id && w.medium === work.medium && w.decade !== work.decade
  );
  return [...sameBoth, ...sameMedium].slice(0, limit);
}

export function sortChronological(works: Work[]): Work[] {
  // year DESC (newest first), title ASC; matches legacy `ORDER BY the_year DESC, title`
  return [...works].sort((a, b) => {
    const ay = parseFirstYear(a.year);
    const by = parseFirstYear(b.year);
    if (ay !== by) return by - ay;
    return a.title.localeCompare(b.title);
  });
}

function parseFirstYear(year: string): number {
  const m = year.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}

export function groupByDecade(works: Work[]): Array<{ decade: number; label: string; works: Work[] }> {
  const order = [0, 90, 80, 70, 60]; // 2000s first, 1960s last
  const map = new Map<number, Work[]>();
  for (const w of works) {
    const arr = map.get(w.decade) ?? [];
    arr.push(w);
    map.set(w.decade, arr);
  }
  return order
    .filter((d) => map.has(d))
    .map((d) => ({
      decade: d,
      label: d === 0 ? '2000s' : `19${d}s`,
      works: sortChronological(map.get(d)!),
    }));
}

export const MEDIA: Medium[] = ['painting', 'paper', 'sculpture', 'boxes', 'installation'];
