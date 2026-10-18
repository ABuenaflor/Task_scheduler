// Yellowish gold primary with its complementary royal blue as accent.
export const colors = {
  gold: '#E9B824',
  goldDark: '#B8890B',
  goldSoft: '#FCEFC2',
  bg: '#FFFBEC',
  card: '#FFFFFF',
  text: '#2B2307',
  muted: '#8C7D52',
  border: '#F0E2B2',
  accent: '#2448C9',
  accentSoft: '#E4EAFF',
  danger: '#D64545',
  backdrop: 'rgba(43, 35, 7, 0.35)',
};

export const CURRENCY = '₱';

export const CATEGORIES = [
  { key: 'food', label: 'Food', icon: 'fast-food-outline', color: '#E9A800' },
  { key: 'transportation', label: 'Transportation', icon: 'bus-outline', color: '#2448C9' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', color: '#7B4FE0' },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline', color: '#0E9C9C' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#E0567A' },
  { key: 'health', label: 'Health', icon: 'medkit-outline', color: '#2E9E4F' },
  { key: 'entertainment', label: 'Entertainment', icon: 'game-controller-outline', color: '#EE7A22' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#8A8A8A' },
];

export const getCategory = (key) =>
  CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

export const formatMoney = (n) =>
  `${CURRENCY}${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatCompact = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
};
