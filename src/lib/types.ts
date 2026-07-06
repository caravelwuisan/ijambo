export type Role = 'student' | 'coach' | 'admin'

export interface Profile {
  id: string
  phone: string
  first_name: string
  last_name: string
  email: string | null
  role: Role
  goal: string | null
  target_exam_date: string | null
  locale: string
  created_at: string
  last_seen_at: string | null
}

export type QuestionType = 'qcm' | 'qcm_multiple' | 'gap_fill' | 'ordering' | 'audio_qcm'
export type Section = 'grammar' | 'reading' | 'listening' | 'writing' | 'speaking'
export type ContentStatus = 'draft' | 'published' | 'archived'

export interface Question {
  id: string
  type: QuestionType
  section: Section
  difficulty: number
  stem_fr: string
  stem_en: string | null
  passage_id: string | null
  audio_url: string | null
  options: string[]
  correct: number[]
  explanation_fr: string | null
  explanation_en: string | null
  weight: number
  tags: string[]
  status: ContentStatus
  created_by: string | null
  created_at: string
  updated_at: string
  passage?: Passage | null
}

export interface Passage {
  id: string
  title: string
  body: string
  audio_url: string | null
}

export interface ScoringBand {
  min: number
  max: number
  cefr: string
  toefl_range: [number, number]
  program_weeks: number
}

export interface Scoring {
  total_points: number
  bands: ScoringBand[]
  det_recommendation_threshold: number
}

export type QuestionRule = { section?: Section; tags?: string[]; difficulty?: [number, number]; count: number }

export interface Test {
  id: string
  name: string
  kind: 'diagnostic' | 'quiz_lecon' | 'section_practice'
  duration_min: number | null
  question_rules: QuestionRule[] | null
  question_ids: string[] | null
  scoring: Scoring | null
  is_active: boolean
  status: ContentStatus
  created_at: string
  updated_at: string
}

export interface ExamSection {
  name: string
  duration_min: number
  question_ids?: string[]
  rules?: QuestionRule[]
  order: number
  instructions_fr?: string
  instructions_en?: string
}

export interface Exam {
  id: string
  name: string
  target: 'toefl' | 'ielts' | 'det'
  sections: ExamSection[]
  status: ContentStatus
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  name: string
  target: string
  description: string | null
  duration_weeks: number | null
  status: ContentStatus
  sort: number
}

export interface Module {
  id: string
  course_id: string
  name: string
  icon: string | null
  sort: number
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  body_md: string | null
  audio_url: string | null
  quiz_test_id: string | null
  pass_threshold: number
  est_minutes: number | null
  sort: number
  status: ContentStatus
}

export interface Plan {
  id: string
  name: string
  price_bif: number
  access_days: number
  features: { fr: string[]; en?: string[]; highlight?: boolean }
  course_ids: string[]
  exam_quota: number
  coaching_sessions: number
  is_active: boolean
}

export interface Enrollment {
  id: string
  user_id: string
  plan_id: string
  course_id: string | null
  starts_at: string
  expires_at: string
  status: string
}

export interface Attempt {
  id: string
  user_id: string
  test_id: string | null
  exam_id: string | null
  kind: string
  started_at: string
  finished_at: string | null
  answers: Record<string, number[]>
  raw_score: number | null
  section_scores: Record<string, number> | null
  cefr: string | null
  projected_score: number | null
}

export interface Payment {
  id: string
  user_id: string
  plan_id: string
  reference: string
  amount_bif: number
  channel: 'lumicash' | 'card' | 'manual'
  status: 'pending' | 'verified' | 'manual_review' | 'rejected' | 'expired'
  sms_raw: string | null
  verified_at: string | null
  created_at: string
}

export interface CoachingSlot {
  id: string
  coach_id: string
  starts_at: string
  duration_min: number
  capacity: number
  topic: string | null
  status: string
}

export interface Booking {
  id: string
  slot_id: string
  user_id: string
  status: string
  created_at: string
}

export interface Submission {
  id: string
  user_id: string
  attempt_id: string
  section: string
  content: string | null
  audio_url: string | null
  status: string
  assigned_coach: string | null
  score: number | null
  feedback: string | null
  corrected_at: string | null
}
