export const EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT = 'erebus-player-damage-feedback';

export type PlayerDamageFeedbackTone = 'health' | 'shield' | 'fatal';

export interface PlayerDamageFeedbackDetail {
  damage: number;
  damageType?: string;
  tone?: PlayerDamageFeedbackTone;
  intensity?: number;
  durationMs?: number;
}

