// TypeScript types for GolfRecorder mobile app

export type Handedness = 'right' | 'left';
export type ShotCategory = 'tee' | 'approach' | 'around_green' | 'putt';

export interface Profile {
  id: string; // uuid - PRIMARY KEY references auth.users(id)
  display_name: string;
  handicap_index?: number | null;
  handedness: Handedness;
  uses_advanced_entry: boolean;
}

export interface Course {
  id: string;
  external_id?: string | null;
  name: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, any> | null;
}

export interface CourseTee {
  id: string;
  course_id: string;
  tee_name: string;
  tee_color?: string | null;
  rating?: number | null;
  slope?: number | null;
  yardages?: { [holeNumber: string]: number } | null; // e.g. {"1": 380}
}

export interface CourseHole {
  id: string;
  course_id: string;
  hole_number: number;
  par: number;
  stroke_index?: number | null;
  default_yardage?: number | null;
}

export interface Round {
  id: string;
  user_id: string;
  course_id?: string | null;
  tee_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  holes_played?: number;
  total_score?: number | null;
  par_total?: number | null;
  status?: 'in_progress' | 'completed' | 'abandoned';
  ai_summary_markdown?: string | null;
  weather_data?: any | null;
  weather_fetched_at?: string | null;
}

export interface RoundHole {
  id: string;
  round_id: string;
  hole_number: number;
  par: number;
  gross_score?: number | null;
  putts?: number | null;
  fir?: boolean | null;
  gir?: boolean | null;
  penalties?: number | null;
}

export interface Shot {
  id: string;
  round_id: string;
  round_hole_id?: string | null;
  hole_number: number;
  shot_number: number;
  shot_category: ShotCategory;
  timestamp?: string;
  start_lie?: string | null;
  start_distance_to_hole?: number | null;
  club?: string | null;
  intended_shot_type?: string | null;
  end_lie?: string | null;
  end_distance_to_hole?: number | null;
  result_zone?: string | null;
  penalty_strokes?: number | null;
  penalty_type?: string | null;
  holed?: boolean | null;
  contact_quality?: string | null;
  shot_shape?: string | null;
  trajectory?: string | null;
  distance_error?: string | null;
  lateral_error?: string | null;
  difficulty_rating?: number | null;
  decision_quality?: string | null;
  mental_tag?: string | null;
  putt_break?: string | null;
  putt_slope?: string | null;
  putt_miss_side?: string | null;
  green_surface?: string | null;
  wind_strength?: string | null;
  wind_direction_relative?: string | null;
  lie_severity?: string | null;
  notes?: string | null;
}

export interface RoundSummaryRequest {
  player_profile: {
    display_name: string;
    handicap_index?: number | null;
    handedness?: Handedness;
  };
  round: {
    id: string;
    course_name?: string | null;
    tee_name?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    holes_played?: number;
    total_score?: number | null;
    par_total?: number | null;
  };
  round_holes: RoundHole[];
  shots: Shot[];
  settings: { distance_unit: 'yards' | 'meters' };
}

