-- Extended exam planner fields
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS planner_data JSONB NOT NULL DEFAULT '{}'::jsonb;
