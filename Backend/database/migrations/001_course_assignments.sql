-- CampusZ LMS target migration for the Generic Course + Course Assignment design.
-- IMPORTANT: Do not run this until the matching backend/frontend code is ready.
-- This migration is intentionally additive/non-destructive so legacy mobile-app
-- reads can continue using old course/activity columns during transition.

BEGIN;

-- =========================================================
-- 1. GENERIC COURSES
-- =========================================================

-- Legacy columns are RETAINED for compatibility, but no longer required by
-- new Admin Panel course creation.
ALTER TABLE public.courses ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN department DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN semester DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN semester_id DROP NOT NULL;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS catalog_department_code text,
  ADD COLUMN IF NOT EXISTS catalog_program_code text;

UPDATE public.courses c
SET catalog_department_code = d.code
FROM public.academic_departments d
WHERE c.department_id = d.id
  AND c.catalog_department_code IS NULL
  AND d.code IS NOT NULL;

UPDATE public.courses c
SET catalog_program_code = p.code
FROM public.academic_programs p
WHERE c.program_id = p.id
  AND c.catalog_program_code IS NULL
  AND p.code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_catalog_identity
  ON public.courses(catalog_department_code, catalog_program_code);

COMMENT ON COLUMN public.courses.teacher_id IS
  'Legacy compatibility only. Current teacher belongs to course_assignments.teacher_id.';
COMMENT ON COLUMN public.courses.batch_id IS
  'Legacy compatibility only. New teaching context belongs to course_assignments.';
COMMENT ON COLUMN public.courses.semester_id IS
  'Legacy compatibility only. New teaching context belongs to course_assignments.';

-- =========================================================
-- 2. COURSE ASSIGNMENTS
-- One stable row per Course + Batch + Semester.
-- Teacher replacement updates teacher_id on the SAME row.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL
    CONSTRAINT course_assignments_course_id_fkey
    REFERENCES public.courses(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL
    CONSTRAINT course_assignments_batch_id_fkey
    REFERENCES public.academic_batches(id) ON DELETE RESTRICT,
  semester_id uuid NOT NULL
    CONSTRAINT course_assignments_semester_id_fkey
    REFERENCES public.academic_semesters(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL
    CONSTRAINT course_assignments_teacher_id_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_assignments_unique_context
    UNIQUE(course_id, batch_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_course_assignments_teacher
  ON public.course_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_batch_semester
  ON public.course_assignments(batch_id, semester_id);

-- =========================================================
-- 3. COURSE ASSIGNMENT TEACHER HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS public.course_assignment_teacher_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_assignment_id uuid NOT NULL
    CONSTRAINT course_assignment_teacher_history_course_assignment_id_fkey
    REFERENCES public.course_assignments(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL
    CONSTRAINT course_assignment_teacher_history_teacher_id_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

CREATE INDEX IF NOT EXISTS idx_course_assignment_teacher_history_assignment
  ON public.course_assignment_teacher_history(course_assignment_id);
CREATE INDEX IF NOT EXISTS idx_course_assignment_teacher_history_teacher
  ON public.course_assignment_teacher_history(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_assignment_current_teacher
  ON public.course_assignment_teacher_history(course_assignment_id)
  WHERE is_current = true;

CREATE OR REPLACE FUNCTION public.lms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_assignments_updated_at
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignments_updated_at
BEFORE UPDATE ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

CREATE OR REPLACE FUNCTION public.lms_track_course_assignment_teacher()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.course_assignment_teacher_history(
      course_assignment_id, teacher_id, assigned_at, is_current
    ) VALUES (
      NEW.id, NEW.teacher_id, COALESCE(NEW.created_at, now()), true
    );
    RETURN NEW;
  END IF;

  IF OLD.teacher_id IS DISTINCT FROM NEW.teacher_id THEN
    UPDATE public.course_assignment_teacher_history
    SET unassigned_at = now(), is_current = false
    WHERE course_assignment_id = NEW.id
      AND is_current = true;

    INSERT INTO public.course_assignment_teacher_history(
      course_assignment_id, teacher_id, assigned_at, is_current
    ) VALUES (NEW.id, NEW.teacher_id, now(), true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_assignment_teacher_insert
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignment_teacher_insert
AFTER INSERT ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.lms_track_course_assignment_teacher();

DROP TRIGGER IF EXISTS trg_course_assignment_teacher_update
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignment_teacher_update
AFTER UPDATE OF teacher_id ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.lms_track_course_assignment_teacher();

-- Backfill one assignment for legacy course rows that already contain a full
-- teacher/batch/semester context. This does not delete or merge old courses.
INSERT INTO public.course_assignments(
  course_id, batch_id, semester_id, teacher_id, status, created_at, updated_at
)
SELECT
  c.id,
  c.batch_id,
  c.semester_id,
  c.teacher_id,
  'active',
  COALESCE(c.created_at, now()),
  COALESCE(c.updated_at, now())
FROM public.courses c
WHERE c.batch_id IS NOT NULL
  AND c.semester_id IS NOT NULL
  AND c.teacher_id IS NOT NULL
ON CONFLICT (course_id, batch_id, semester_id) DO NOTHING;

-- If course_assignments already existed before this migration revision, make
-- sure they also have a current history row.
INSERT INTO public.course_assignment_teacher_history(
  course_assignment_id, teacher_id, assigned_at, is_current
)
SELECT ca.id, ca.teacher_id, ca.created_at, true
FROM public.course_assignments ca
WHERE NOT EXISTS (
  SELECT 1
  FROM public.course_assignment_teacher_history h
  WHERE h.course_assignment_id = ca.id
    AND h.is_current = true
);

-- =========================================================
-- 4. ENROLLMENTS
-- =========================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS course_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS semester_id uuid,
  ADD COLUMN IF NOT EXISTS enrollment_type text NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_course_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_course_assignment_id_fkey
      FOREIGN KEY (course_assignment_id)
      REFERENCES public.course_assignments(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_semester_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_semester_id_fkey
      FOREIGN KEY (semester_id)
      REFERENCES public.academic_semesters(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enrollments_enrollment_type_check'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_enrollment_type_check
      CHECK (enrollment_type IN ('regular', 'supply'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_course_assignment
  ON public.enrollments(course_assignment_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_semester
  ON public.enrollments(semester_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_type
  ON public.enrollments(enrollment_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_student_course_assignment
  ON public.enrollments(student_id, course_assignment_id)
  WHERE course_assignment_id IS NOT NULL AND status = 'active';

-- Safe legacy enrollment backfill.
UPDATE public.enrollments e
SET batch_id = c.batch_id
FROM public.courses c
WHERE e.course_id = c.id
  AND e.batch_id IS NULL
  AND c.batch_id IS NOT NULL;

UPDATE public.enrollments e
SET semester_id = c.semester_id
FROM public.courses c
WHERE e.course_id = c.id
  AND e.semester_id IS NULL
  AND c.semester_id IS NOT NULL;

UPDATE public.enrollments e
SET course_assignment_id = ca.id
FROM public.course_assignments ca
WHERE e.course_assignment_id IS NULL
  AND e.course_id = ca.course_id
  AND e.batch_id = ca.batch_id
  AND e.semester_id = ca.semester_id;

-- =========================================================
-- 5. TEACHING ACTIVITY CONTEXT
-- Keep course_id / teacher_id for compatibility and original ownership.
-- New Admin/Teacher writes should also set course_assignment_id.
-- =========================================================

DO $$
DECLARE
  table_name text;
  constraint_name text;
  index_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'announcements',
    'assignments',
    'attendance_records',
    'live_sessions',
    'materials',
    'periods',
    'quizzes',
    'gradebook_components',
    'gradebook_approvals'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS course_assignment_id uuid',
      table_name
    );

    constraint_name := table_name || '_course_assignment_id_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (course_assignment_id) REFERENCES public.course_assignments(id) ON DELETE RESTRICT',
        table_name,
        constraint_name
      );
    END IF;

    index_name := 'idx_' || table_name || '_course_assignment';
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(course_assignment_id)',
      index_name,
      table_name
    );
  END LOOP;
END $$;

-- Only auto-link old activity when exactly one Course Assignment exists for
-- that course. Ambiguous old history stays NULL for manual review rather than
-- being attached to the wrong batch/semester.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'announcements',
    'assignments',
    'attendance_records',
    'live_sessions',
    'materials',
    'periods',
    'quizzes',
    'gradebook_components',
    'gradebook_approvals'
  ]
  LOOP
    EXECUTE format(
      $sql$
      UPDATE public.%I target
      SET course_assignment_id = only_assignment.assignment_id
      FROM (
        SELECT course_id, (array_agg(id ORDER BY created_at))[1] AS assignment_id
        FROM public.course_assignments
        GROUP BY course_id
        HAVING count(*) = 1
      ) only_assignment
      WHERE target.course_assignment_id IS NULL
        AND target.course_id = only_assignment.course_id
      $sql$,
      table_name
    );
  END LOOP;
END $$;

-- =========================================================
-- 6. ATTENDANCE SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_assignment_id uuid NOT NULL
    CONSTRAINT attendance_sessions_course_assignment_id_fkey
    REFERENCES public.course_assignments(id) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL
    CONSTRAINT attendance_sessions_teacher_id_fkey
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_assignment
  ON public.attendance_sessions(course_assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date
  ON public.attendance_sessions(attendance_date);

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS attendance_session_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_attendance_session_id_fkey'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_attendance_session_id_fkey
      FOREIGN KEY (attendance_session_id)
      REFERENCES public.attendance_sessions(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_records_session
  ON public.attendance_records(attendance_session_id);

-- =========================================================
-- 7. STUDENT ACADEMIC HISTORY FOR PROMOTION
-- profiles = current placement, this table = historical placements.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.student_academic_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL
    REFERENCES public.academic_batches(id) ON DELETE RESTRICT,
  department_id uuid NOT NULL
    REFERENCES public.academic_departments(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL
    REFERENCES public.academic_programs(id) ON DELETE RESTRICT,
  semester_id uuid NOT NULL
    REFERENCES public.academic_semesters(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'current'
    CHECK (status IN ('current', 'promoted', 'completed', 'withdrawn')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  changed_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_academic_history_student
  ON public.student_academic_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_academic_history_semester
  ON public.student_academic_history(semester_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_current_academic_history
  ON public.student_academic_history(student_id)
  WHERE status = 'current' AND ended_at IS NULL;

DROP TRIGGER IF EXISTS trg_student_academic_history_updated_at
  ON public.student_academic_history;
CREATE TRIGGER trg_student_academic_history_updated_at
BEFORE UPDATE ON public.student_academic_history
FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

INSERT INTO public.student_academic_history(
  student_id,
  batch_id,
  department_id,
  program_id,
  semester_id,
  status,
  started_at
)
SELECT
  p.id,
  p.batch_id,
  p.department_id,
  p.program_id,
  p.semester_id,
  'current',
  COALESCE(p.updated_at, p.created_at, now())
FROM public.profiles p
WHERE p.role = 'student'
  AND p.batch_id IS NOT NULL
  AND p.department_id IS NOT NULL
  AND p.program_id IS NOT NULL
  AND p.semester_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_academic_history h
    WHERE h.student_id = p.id
      AND h.status = 'current'
      AND h.ended_at IS NULL
  );


-- =========================================================
-- 8. PROMOTION RPC
-- Promotion updates CURRENT placement + history only.
-- It intentionally does NOT create course enrollments.
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
BEGIN
  SELECT id, program_id, name, semester_number
  INTO v_target
  FROM public.academic_semesters
  WHERE id = p_to_semester_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target semester does not exist';
  END IF;

  FOREACH v_student_id IN ARRAY p_student_ids
  LOOP
    SELECT
      p.id,
      p.role,
      p.is_active,
      p.batch_id,
      p.department_id,
      p.program_id,
      p.semester_id,
      p.created_at
    INTO v_student
    FROM public.profiles p
    WHERE p.id = v_student_id;

    IF NOT FOUND OR v_student.role <> 'student' THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id,
        'reason', 'Student not found'
      ));
      CONTINUE;
    END IF;

    IF v_student.is_active = false THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id,
        'reason', 'Student is inactive'
      ));
      CONTINUE;
    END IF;

    IF v_student.program_id IS DISTINCT FROM v_target.program_id THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id,
        'reason', 'Target semester belongs to another program'
      ));
      CONTINUE;
    END IF;

    IF v_student.semester_id = p_to_semester_id THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id,
        'reason', 'Student is already in the target semester'
      ));
      CONTINUE;
    END IF;

    SELECT semester_number
    INTO v_current_semester_number
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
        'student_id', v_student_id,
        'reason', 'Student academic placement is incomplete'
      ));
      CONTINUE;
    END IF;

    UPDATE public.student_academic_history
    SET
      status = 'promoted',
      ended_at = now(),
      changed_by = p_changed_by,
      updated_at = now()
    WHERE student_id = v_student_id
      AND status = 'current'
      AND ended_at IS NULL;

    GET DIAGNOSTICS v_closed = ROW_COUNT;

    -- Legacy students that had no history row still retain their old semester.
    IF v_closed = 0 THEN
      INSERT INTO public.student_academic_history(
        student_id,
        batch_id,
        department_id,
        program_id,
        semester_id,
        status,
        started_at,
        ended_at,
        changed_by
      ) VALUES (
        v_student_id,
        v_student.batch_id,
        v_student.department_id,
        v_student.program_id,
        v_student.semester_id,
        'promoted',
        COALESCE(v_student.created_at, now()),
        now(),
        p_changed_by
      );
    END IF;

    UPDATE public.profiles
    SET
      semester_id = p_to_semester_id,
      semester = v_target.name,
      updated_at = now()
    WHERE id = v_student_id;

    INSERT INTO public.student_academic_history(
      student_id,
      batch_id,
      department_id,
      program_id,
      semester_id,
      status,
      started_at,
      changed_by
    ) VALUES (
      v_student_id,
      v_student.batch_id,
      v_student.department_id,
      v_student.program_id,
      p_to_semester_id,
      'current',
      now(),
      p_changed_by
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
