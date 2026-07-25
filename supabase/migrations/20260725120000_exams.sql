-- Exams planner table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  exam_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','studying','review','ready','done')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exams_user_date_idx ON public.exams(user_id, exam_date);
CREATE INDEX exams_subject_idx ON public.exams(subject_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exams" ON public.exams FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER t_exams_upd BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
