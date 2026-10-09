-- CampusZ LMS - runtime/history/gradebook/announcement compatibility migration
-- Run AFTER 001_course_assignments.sql, 002_permanent_roll_numbers.sql and 003_visibility_and_promotion.sql.
-- Safe goals:
--   * preserve all historical rows
--   * promoted students only see current regular enrollments as current courses
--   * restore Course Assignment context on quizzes/gradebook/activity records
--   * restore gradebook_components while preserving existing gradebook_marks/gradebook_approvals
--   * support announcement attachments

BEGIN;

-- =========================================================
-- 1. RESTORE / NORMALIZE GRADEBOOK COMPONENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.gradebook_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE RESTRICT,
  course_assignment_id uuid REFERENCES public.course_assignments(id) ON DELETE RESTRICT,
  category text NOT NULL DEFAULT 'manual',
  name text NOT NULL,
  max_marks numeric NOT NULL DEFAULT 0 CHECK (max_marks >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_type text DEFAULT 'manual',
  source_id uuid,
  approval_status text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  rejection_reason text
);

ALTER TABLE public.gradebook_components
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS course_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS max_marks numeric,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gradebook_components_course_id_fkey'
  ) THEN
    ALTER TABLE public.gradebook_components
      ADD CONSTRAINT gradebook_components_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gradebook_components_course_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.gradebook_components
      ADD CONSTRAINT gradebook_components_course_assignment_id_fkey
      FOREIGN KEY (course_assignment_id) REFERENCES public.course_assignments(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gradebook_components_course_assignment
  ON public.gradebook_components(course_assignment_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_components_course
  ON public.gradebook_components(course_id);

-- Existing approvals remain the approval source of truth.
ALTER TABLE public.gradebook_approvals
  ADD COLUMN IF NOT EXISTS course_assignment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gradebook_approvals_course_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.gradebook_approvals
      ADD CONSTRAINT gradebook_approvals_course_assignment_id_fkey
      FOREIGN KEY (course_assignment_id) REFERENCES public.course_assignments(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gradebook_approvals_course_assignment
  ON public.gradebook_approvals(course_assignment_id);

-- Ensure marks can be efficiently read student/course-wise. Existing marks are preserved.
CREATE INDEX IF NOT EXISTS idx_gradebook_marks_component
  ON public.gradebook_marks(component_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_marks_student
  ON public.gradebook_marks(student_id);

-- =========================================================
-- 2. COURSE ASSIGNMENT CONTEXT ON ACTIVITY TABLES
-- =========================================================

DO $$
DECLARE
  t text;
  fk text;
  idx text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assignments',
    'quizzes',
    'materials',
    'attendance_records',
    'announcements',
    'live_sessions',
    'periods'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS course_assignment_id uuid', t);
      fk := t || '_course_assignment_id_fkey';
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (course_assignment_id) REFERENCES public.course_assignments(id) ON DELETE RESTRICT',
          t, fk
        );
      END IF;
      idx := 'idx_' || t || '_course_assignment_id';
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(course_assignment_id)', idx, t);
    END IF;
  END LOOP;
END $$;

-- Safe backfill: only when a generic course currently has exactly one Course Assignment.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assignments',
    'quizzes',
    'materials',
    'attendance_records',
    'announcements',
    'live_sessions',
    'periods',
    'gradebook_components',
    'gradebook_approvals'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format($q$
        UPDATE public.%I target
        SET course_assignment_id = one_ca.assignment_id
        FROM (
          SELECT course_id, (array_agg(id ORDER BY id))[1] AS assignment_id
          FROM public.course_assignments
          GROUP BY course_id
          HAVING COUNT(*) = 1
        ) one_ca
        WHERE target.course_assignment_id IS NULL
          AND target.course_id = one_ca.course_id
      $q$, t);
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- 3. ANNOUNCEMENT ATTACHMENTS
-- =========================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes bigint;

-- =========================================================
-- 4. ENROLLMENT CONTEXT + PROMOTION VISIBILITY
-- =========================================================

-- First recover an exact Course Assignment for legacy enrollment rows whenever
-- course + batch + semester already identify one teaching context.
UPDATE public.enrollments e
SET
  course_assignment_id = ca.id,
  updated_at = now()
FROM public.course_assignments ca
WHERE e.course_assignment_id IS NULL
  AND e.course_id = ca.course_id
  AND e.batch_id = ca.batch_id
  AND e.semester_id = ca.semester_id;

-- Legacy courses may still carry the old batch/semester context. Use it only
-- to fill missing enrollment context; the generic Course architecture remains unchanged.
UPDATE public.enrollments e
SET
  batch_id = COALESCE(e.batch_id, c.batch_id),
  semester_id = COALESCE(e.semester_id, c.semester_id),
  updated_at = now()
FROM public.courses c
WHERE e.course_id = c.id
  AND (e.batch_id IS NULL OR e.semester_id IS NULL)
  AND (c.batch_id IS NOT NULL OR c.semester_id IS NOT NULL);

-- Try exact Course Assignment linking again after legacy context backfill.
UPDATE public.enrollments e
SET
  course_assignment_id = ca.id,
  updated_at = now()
FROM public.course_assignments ca
WHERE e.course_assignment_id IS NULL
  AND e.course_id = ca.course_id
  AND e.batch_id = ca.batch_id
  AND e.semester_id = ca.semester_id;

-- Fill enrollment context from Course Assignment where possible.
UPDATE public.enrollments e
SET
  semester_id = COALESCE(e.semester_id, ca.semester_id),
  batch_id = COALESCE(e.batch_id, ca.batch_id),
  updated_at = now()
FROM public.course_assignments ca
WHERE e.course_assignment_id = ca.id
  AND (e.semester_id IS NULL OR e.batch_id IS NULL);

-- One-time reconciliation for students who were already promoted.
-- IMPORTANT: rows are NOT deleted. Completed rows remain available to all history APIs.
UPDATE public.enrollments e
SET
  status = 'completed',
  completed_at = COALESCE(e.completed_at, now()),
  updated_at = now()
FROM public.profiles p
WHERE e.student_id = p.id
  AND p.role = 'student'
  AND COALESCE(e.enrollment_type, 'regular') = 'regular'
  AND e.status = 'active'
  AND e.semester_id IS NOT NULL
  AND p.semester_id IS NOT NULL
  AND e.semester_id <> p.semester_id;

-- =========================================================
-- 5. PROMOTION RPC: CLOSE CURRENT REGULAR ENROLLMENTS, KEEP HISTORY
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_promote_students(
  p_student_ids uuid[],
  p_to_semester_id uuid,
  p_changed_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_student record;
  v_target record;
  v_current_semester_number integer;
  v_promoted integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_closed integer;
  v_now timestamptz;
BEGIN
  SELECT id, program_id, name, semester_number
  INTO v_target
  FROM public.academic_semesters
  WHERE id = p_to_semester_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target semester does not exist or is inactive';
  END IF;

  FOREACH v_student_id IN ARRAY p_student_ids
  LOOP
    SELECT
      p.id, p.role, p.is_active, p.batch_id, p.department_id,
      p.program_id, p.semester_id, p.created_at
    INTO v_student
    FROM public.profiles p
    WHERE p.id = v_student_id;

    IF NOT FOUND OR v_student.role <> 'student' THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'reason', 'Student not found'
      ));
      CONTINUE;
    END IF;

    IF v_student.is_active = false THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'reason', 'Student is inactive'
      ));
      CONTINUE;
    END IF;

    IF v_student.program_id IS DISTINCT FROM v_target.program_id THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'reason', 'Target semester belongs to another program'
      ));
      CONTINUE;
    END IF;

    IF v_student.semester_id = p_to_semester_id THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT semester_number INTO v_current_semester_number
    FROM public.academic_semesters
    WHERE id = v_student.semester_id;

    IF v_current_semester_number IS NULL
       OR v_target.semester_number <= v_current_semester_number THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id,
        'reason', 'Promotion target must be a later semester in the same program'
      ));
      CONTINUE;
    END IF;

    IF v_student.batch_id IS NULL
       OR v_student.department_id IS NULL
       OR v_student.program_id IS NULL
       OR v_student.semester_id IS NULL THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'reason', 'Student academic placement is incomplete'
      ));
      CONTINUE;
    END IF;

    v_now := now();

    -- Academic placement history is closed, never deleted.
    UPDATE public.student_academic_history
    SET status = 'promoted', ended_at = v_now, changed_by = p_changed_by, updated_at = v_now
    WHERE student_id = v_student_id
      AND status = 'current'
      AND ended_at IS NULL;
    GET DIAGNOSTICS v_closed = ROW_COUNT;

    IF v_closed = 0 THEN
      INSERT INTO public.student_academic_history(
        student_id, batch_id, department_id, program_id, semester_id,
        status, started_at, ended_at, changed_by
      ) VALUES (
        v_student_id, v_student.batch_id, v_student.department_id,
        v_student.program_id, v_student.semester_id, 'promoted',
        COALESCE(v_student.created_at, v_now), v_now, p_changed_by
      );
    END IF;

    -- Close ONLY the previous semester's active REGULAR enrollments.
    -- No enrollment/activity/history row is deleted.
    UPDATE public.enrollments
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, v_now),
      updated_at = v_now
    WHERE student_id = v_student_id
      AND COALESCE(enrollment_type, 'regular') = 'regular'
      AND status = 'active'
      AND semester_id = v_student.semester_id;

    UPDATE public.profiles
    SET semester_id = p_to_semester_id,
        semester = v_target.name,
        updated_at = v_now
    WHERE id = v_student_id;

    INSERT INTO public.student_academic_history(
      student_id, batch_id, department_id, program_id, semester_id,
      status, started_at, changed_by
    ) VALUES (
      v_student_id, v_student.batch_id, v_student.department_id,
      v_student.program_id, p_to_semester_id, 'current', v_now, p_changed_by
    );

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted', v_promoted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promote_students(uuid[], uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_promote_students(uuid[], uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
