import type { Badge } from '@/components/GameContext';

export type GamificationRarity = Badge['rarity'];

export const badgeCatalog: Array<
  Omit<Badge, 'earnedAt'> & {
    id: string;
  }
> = [
  {
    id: 'badge-week-warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak.',
    emoji: '🔥',
    rarity: 'legendary',
    xpReward: 500,
  },
  {
    id: 'badge-hot-streak',
    name: 'Hot Streak',
    description: 'Reach a 3-day streak.',
    emoji: '⚡',
    rarity: 'epic',
    xpReward: 250,
  },
  {
    id: 'badge-ats-expert',
    name: 'ATS Expert',
    description: 'Reach an ATS score of 80+.',
    emoji: '🎯',
    rarity: 'epic',
    xpReward: 300,
  },
  {
    id: 'badge-xp-500',
    name: 'XP Starter',
    description: 'Earn 500 total XP.',
    emoji: '🧪',
    rarity: 'rare',
    xpReward: 150,
  },
  {
    id: 'badge-xp-1500',
    name: 'XP Architect',
    description: 'Earn 1500 total XP.',
    emoji: '🏗️',
    rarity: 'rare',
    xpReward: 250,
  },
];

