// These are the starter titles already available to every prototype account.
export const STARTER_TITLES = ['뉴비 머미러', '신중한 관찰자', '밤의 기록자'] as const;
export type StarterTitle = typeof STARTER_TITLES[number];

export function isOwnedTitle(value: unknown): value is StarterTitle {
 return typeof value === 'string' && STARTER_TITLES.some(title => title === value);
}
