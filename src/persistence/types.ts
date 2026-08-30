export interface SkillProgress {
  name: string;
  score: number;
}

export interface GuestProgress {
  version: 1;
  gamesCompleted: number;
  assistanceLevel: number;
  skills: SkillProgress[];
  experiencePoints: number;
  updatedAt: string;
}

export interface PlayerProgressRow {
  user_id: string;
  games_completed: number;
  current_assistance_level: number;
  skills_json: Record<string, number>;
  experience_points: number;
  updated_at: string;
}

export interface ProgressSyncResult {
  ok: boolean;
  progress?: PlayerProgressRow;
  message: string;
}
