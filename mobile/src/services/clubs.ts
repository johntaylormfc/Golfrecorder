// Standard golf club types in typical bag order
export const STANDARD_CLUBS = [
  'Driver',
  '3 Wood',
  '5 Wood',
  '7 Wood',
  '2 Hybrid',
  '3 Hybrid',
  '4 Hybrid',
  '5 Hybrid',
  '2 Iron',
  '3 Iron',
  '4 Iron',
  '5 Iron',
  '6 Iron',
  '7 Iron',
  '8 Iron',
  '9 Iron',
  'Pitching Wedge',
  'Gap Wedge',
  'Sand Wedge',
  'Lob Wedge',
  'Putter',
] as const;

export type ClubType = typeof STANDARD_CLUBS[number];
