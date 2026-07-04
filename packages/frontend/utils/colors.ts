/** Single employee color palette used across calendar, staff, and booking UIs. */
export const employeeColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
];

export const employeeBorderColors = [
  'border-[var(--color-primary)]',
  'border-emerald-500',
  'border-violet-500',
  'border-orange-400',
  'border-teal-500',
  'border-pink-400',
];

export function colorForIndex(index: number): string {
  return employeeColors[index % employeeColors.length];
}

export function borderColorForIndex(index: number): string {
  return employeeBorderColors[index % employeeBorderColors.length];
}

/** Stable color per name: same employee always renders the same color. */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return employeeColors[Math.abs(hash) % employeeColors.length];
}
