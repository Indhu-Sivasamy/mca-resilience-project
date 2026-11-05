export const LEVEL_COLORS = {
  Critical: '#dc2626',
  High: '#f59e0b',
  Medium: '#3b82f6',
  Low: '#16a34a',
};

export const IND_COLORS = {
  unemployment: '#2563eb',
  poverty: '#dc2626',
  literacy: '#16a34a',
  healthcare: '#f59e0b',
  housing: '#7c3aed',
  income: '#16a34a',
  infant_mortality: '#f59e0b',
  electricity: '#7c3aed',
  sanitation: '#0891b2',
};

export const fmt = (n, digits = 2) => Number(n).toFixed(digits);

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
