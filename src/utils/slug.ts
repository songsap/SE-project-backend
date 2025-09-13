import slugify from 'slugify';

export function toSlug(name: string) {
  let s = (name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();

  s = s.replace(/[\s_]+/g, '-');

  s = s.replace(/[^\u0E00-\u0E7Fa-z0-9-]/g, '');

  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (!s) s = 'restaurant-' + Date.now();

  return s;
}