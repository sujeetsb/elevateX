export function getLevelName(level: number): string {
  if (level >= 50) return 'AI Career Master';
  if (level >= 35) return 'Expert';
  if (level >= 20) return 'Professional';
  if (level >= 10) return 'Builder';
  if (level >= 5) return 'Learner';
  return 'Explorer';
}

export function calculateLevel(xp: number) {
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  return { level, currentLevelXp, totalXpForNextLevel: 500, levelName: getLevelName(level) };
}
