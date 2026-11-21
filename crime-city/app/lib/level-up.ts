export type LevelSnapshot = {userId: string; level: number};
export type LevelAdvance = {from: number; to: number};

export function levelSnapshot(user: {id?: string; clears?: number} | null | undefined): LevelSnapshot | null {
  if (!user?.id || !Number.isSafeInteger(user.clears) || Number(user.clears) < 0) return null;
  return {userId: user.id, level: 1 + Math.floor(Number(user.clears) / 5)};
}

export function levelAdvance(before: LevelSnapshot | null, after: LevelSnapshot | null): LevelAdvance | null {
  if (!before || !after || before.userId !== after.userId || after.level <= before.level) return null;
  return {from: before.level, to: after.level};
}
