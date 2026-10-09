-- CampusZ LMS - Admin Assessment Scheduling
-- Run AFTER the current live-schema migrations.
-- Additive migration: existing quizzes, assignments, enrollments and mobile reads are preserved.

BEGIN;

-- =========================================================
-- 1. ADMIN ASSESSMENT PLAN
-- =========================================================

CREATE TABLE IF NOT EXISTS public.assessment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  assessment_type text NOT NULL
    CHECK (assessment_type IN ('quiz', 'assignment', 'mid', 'final')),
  scope_type text NOT NULL
    CHECK (scope_type IN ('semester', 'course')),
  department_id uuid NOT NULL
    CONSTRAINT assessment_plans_department_id_fkey
    REFERENCES public.academic_departments(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL
    CONSTRAINT assessment_plans_program_id_fkey
    REFERENCES public.academic_programs(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL
    CONSTRAINT assessment_plans_batch_id_fkey
    REFERENCES public.academic_batches(id) ON DELETE RESTRICT,
  semester_id uuid NOT NULL
    CONSTRAINT assessment_plans_semester_id_fkey
    REFERENCES public.academic_semesters(id) ON DELETE RESTRICT,
  default_start_at timestamptz NOT NULL,
  default_end_at timestamptz NOT NULL,
  default_max_marks numeric NOT NULL CHECK (default_max_marks > 0),
  instructions text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'cancelled')),
  created_by uuid
    CONSTRAINT assessment_plans_created_by_fkey
    REFERENCES public.admins(id) ON DELETE SET NULL,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (default_end_at > default_start_at)
);

CREATE INDEX IF NOT EXISTS idx_assessment_plans_scope
  ON public.assessment_plans(batch_id, semester_id, assessment_type, status);
CREATE INDEX IF NOT EXISTS idx_assessment_plans_program
  ON public.assessment_plans(department_id, program_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_assessment_plans_created_at
  ON public.assessment_plans(created_at DESC);

-- =========================================================
-- 2. COURSE-WISE SCHEDULE ITEMS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.assessment_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_plan_id uuid NOT NULL
    CONSTRAINT assessment_schedule_items_plan_id_fkey
    REFERENCES public.assessment_plans(id) ON DELETE CASCADE,
  course_assignment_id uuid NOT NULL
    CONSTRAINT assessment_schedule_items_course_assignment_id_fkey
    REFERENCES public.course_assignments(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_marks numeric NOT NULL CHECK (max_marks > 0),
  linked_quiz_id uuid
    CONSTRAINT assessment_schedule_items_quiz_id_fkey
    REFERENCES public.quizzes(id) ON DELETE SET NULL,
  linked_assignment_id uuid
    CONSTRAINT assessment_schedule_items_assignment_id_fkey
    REFERENCES public.assignments(id) ON DELETE SET NULL,
  linked_gradebook_component_id uuid
    CONSTRAINT assessment_schedule_items_gradebook_component_id_fkey
    REFERENCES public.gradebook_components(id) ON DELETE SET NULL,
  prepared_at timestamptz,
  execution_started_at timestamptz,
  results_submitted_at timestamptz,
  completed_by uuid
    CONSTRAINT assessment_schedule_items_completed_by_fkey
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  result_status text NOT NULL DEFAULT 'pending'
    CHECK (result_status IN (
      'pending', 'prepared', 'in_progress', 'result_pending',
      'completed', 'missed', 'cancelled'
    )),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_plan_course_assignment
    UNIQUE (assessment_plan_id, course_assignment_id),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_assessment_items_assignment
  ON public.assessment_schedule_items(course_assignment_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_assessment_items_plan
  ON public.assessment_schedule_items(assessment_plan_id);
CREATE INDEX IF NOT EXISTS idx_assessment_items_window
  ON public.assessment_schedule_items(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_assessment_items_result_status
  ON public.assessment_schedule_items(result_status);

-- =========================================================
-- 3. PUBLISHED ROSTER SNAPSHOT
-- =========================================================

CREATE TABLE IF NOT EXISTS public.assessment_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL
    CONSTRAINT assessment_roster_schedule_item_id_fkey
    REFERENCES public.assessment_schedule_items(id) ON DELETE CASCADE,
  enrollment_id uuid
    CONSTRAINT assessment_roster_enrollment_id_fkey
    REFERENCES public.enrollments(id) ON DELETE SET NULL,
  student_id uuid NOT NULL
    CONSTRAINT assessment_roster_student_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  eligibility_status text NOT NULL DEFAULT 'eligible'
    CHECK (eligibility_status IN ('eligible', 'withdrawn', 'exempt')),
  result_status text NOT NULL DEFAULT 'pending'
    CHECK (result_status IN ('pending', 'graded', 'absent', 'exempt')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_roster_item_student
    UNIQUE (schedule_item_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_roster_student
  ON public.assessment_roster(student_id, schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_assessment_roster_enrollment
  ON public.assessment_roster(enrollment_id);

-- =========================================================
-- 4. NOTIFICATION CONTEXT (NON-DESTRUCTIVE)
-- =========================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS course_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS assessment_schedule_item_id uuid,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_course_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_course_assignment_id_fkey
      FOREIGN KEY (course_assignment_id)
      REFERENCES public.course_assignments(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_assessment_schedule_item_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_assessment_schedule_item_id_fkey
      FOREIGN KEY (assessment_schedule_item_id)
      REFERENCES public.assessment_schedule_items(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_course_assignment
  ON public.notifications(course_assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_assessment_item
  ON public.notifications(assessment_schedule_item_id, created_at DESC);

-- =========================================================
-- 5. UPDATED_AT TRIGGERS
-- Existing lms_touch_updated_at() is reused.
-- =========================================================

DROP TRIGGER IF EXISTS trg_assessment_plans_updated_at ON public.assessment_plans;
CREATE TRIGGER trg_assessment_plans_updated_at
BEFORE UPDATE ON public.assessment_plans
FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_items_updated_at ON public.assessment_schedule_items;
CREATE TRIGGER trg_assessment_items_updated_at
BEFORE UPDATE ON public.assessment_schedule_items
FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_roster_updated_at ON public.assessment_roster;
CREATE TRIGGER trg_assessment_roster_updated_at
BEFORE UPDATE ON public.assessment_roster
FOR EACH ROW EXECUTE FUNCTION public.lms_touch_updated_at();

-- =========================================================
-- 6. RLS READ HELPERS
-- These helpers enforce current Course Assignment access so promotion hides
-- old schedule cards from Teacher and Student apps without deleting history.
-- =========================================================

CREATE OR REPLACE FUNCTION public.can_view_assessment_item(
  p_item_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assessment_schedule_items asi
    JOIN public.assessment_plans ap ON ap.id = asi.assessment_plan_id
    WHERE asi.id = p_item_id
      AND ap.status IN ('published', 'cancelled')
      AND (
        EXISTS (
          SELECT 1
          FROM public.teacher_current_course_access tca
          WHERE tca.course_assignment_id = asi.course_assignment_id
            AND tca.teacher_id = p_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.assessment_roster ar
          JOIN public.student_current_course_access sca
            ON sca.course_assignment_id = asi.course_assignment_id
           AND sca.student_id = ar.student_id
          WHERE ar.schedule_item_id = asi.id
            AND ar.student_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_assessment_plan(
  p_plan_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assessment_schedule_items asi
    JOIN public.assessment_plans ap ON ap.id = asi.assessment_plan_id
    WHERE ap.id = p_plan_id
      AND ap.status IN ('published', 'cancelled')
      AND (
        EXISTS (
          SELECT 1
          FROM public.teacher_current_course_access tca
          WHERE tca.course_assignment_id = asi.course_assignment_id
            AND tca.teacher_id = p_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.assessment_roster ar
          JOIN public.student_current_course_access sca
            ON sca.course_assignment_id = asi.course_assignment_id
           AND sca.student_id = ar.student_id
          WHERE ar.schedule_item_id = asi.id
            AND ar.student_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_assessment_roster(
  p_item_id uuid,
  p_student_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assessment_schedule_items asi
    JOIN public.assessment_plans ap ON ap.id = asi.assessment_plan_id
    WHERE asi.id = p_item_id
      AND ap.status IN ('published', 'cancelled')
      AND (
        EXISTS (
          SELECT 1
          FROM public.teacher_current_course_access tca
          WHERE tca.course_assignment_id = asi.course_assignment_id
            AND tca.teacher_id = p_user_id
        )
        OR (
          p_student_id = p_user_id
          AND EXISTS (
            SELECT 1
            FROM public.student_current_course_access sca
            WHERE sca.course_assignment_id = asi.course_assignment_id
              AND sca.student_id = p_user_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_assessment_item(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_assessment_plan(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_assessment_roster(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_assessment_item(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_assessment_plan(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_assessment_roster(uuid, uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.assessment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_plans_select_current_access ON public.assessment_plans;
CREATE POLICY assessment_plans_select_current_access
ON public.assessment_plans
FOR SELECT TO authenticated
USING (public.can_view_assessment_plan(id, auth.uid()));

DROP POLICY IF EXISTS assessment_items_select_current_access ON public.assessment_schedule_items;
CREATE POLICY assessment_items_select_current_access
ON public.assessment_schedule_items
FOR SELECT TO authenticated
USING (public.can_view_assessment_item(id, auth.uid()));

DROP POLICY IF EXISTS assessment_roster_select_current_access ON public.assessment_roster;
CREATE POLICY assessment_roster_select_current_access
ON public.assessment_roster
FOR SELECT TO authenticated
USING (public.can_view_assessment_roster(schedule_item_id, student_id, auth.uid()));

-- =========================================================
-- 7. ATOMIC ADMIN CREATE/PUBLISH RPC
-- p_items may contain per-course overrides:
-- [{course_assignment_id, starts_at, ends_at, max_marks}, ...]
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_create_assessment_plan(
  p_title text,
  p_assessment_type text,
  p_scope_type text,
  p_department_id uuid,
  p_program_id uuid,
  p_batch_id uuid,
  p_semester_id uuid,
  p_default_start_at timestamptz,
  p_default_end_at timestamptz,
  p_default_max_marks numeric,
  p_instructions text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_publish boolean DEFAULT false,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_item jsonb;
  v_course_assignment_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_max_marks numeric;
  v_item_id uuid;
  v_course_id uuid;
  v_teacher_id uuid;
  v_course_name text;
  v_semester_program_id uuid;
  v_program_department_id uuid;
  v_items_created integer := 0;
  v_students_snapshotted integer := 0;
  v_notifications_created integer := 0;
  v_target_count integer := 0;
BEGIN
  IF p_assessment_type NOT IN ('quiz', 'assignment', 'mid', 'final') THEN
    RAISE EXCEPTION 'Invalid assessment type';
  END IF;
  IF p_scope_type NOT IN ('semester', 'course') THEN
    RAISE EXCEPTION 'Invalid assessment scope';
  END IF;
  IF p_default_end_at <= p_default_start_at THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;
  IF p_default_max_marks IS NULL OR p_default_max_marks <= 0 THEN
    RAISE EXCEPTION 'Maximum marks must be greater than zero';
  END IF;

  SELECT s.program_id INTO v_semester_program_id
  FROM public.academic_semesters s
  WHERE s.id = p_semester_id AND s.status = 'active';
  IF NOT FOUND OR v_semester_program_id IS DISTINCT FROM p_program_id THEN
    RAISE EXCEPTION 'Selected semester does not belong to the selected active program';
  END IF;

  SELECT pr.department_id INTO v_program_department_id
  FROM public.academic_programs pr
  WHERE pr.id = p_program_id AND pr.status = 'active';
  IF NOT FOUND OR v_program_department_id IS DISTINCT FROM p_department_id THEN
    RAISE EXCEPTION 'Selected program does not belong to the selected active department';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.academic_departments d
    WHERE d.id = p_department_id AND d.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Selected department is inactive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academic_batches b
    WHERE b.id = p_batch_id AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Selected batch is inactive';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one Course Assignment schedule item is required';
  END IF;

  IF p_scope_type = 'semester' THEN
    SELECT count(*) INTO v_target_count
    FROM public.course_assignments ca
    JOIN public.courses c ON c.id = ca.course_id
    WHERE ca.batch_id = p_batch_id
      AND ca.semester_id = p_semester_id
      AND ca.status = 'active'
      AND ca.lifecycle_status = 'active'
      AND COALESCE(c.status, 'published') = 'published';

    IF v_target_count = 0 THEN
      RAISE EXCEPTION 'No active Course Assignments exist in the selected semester';
    END IF;

    IF jsonb_array_length(p_items) <> v_target_count THEN
      RAISE EXCEPTION 'Entire Semester scope must include every active Course Assignment in the selected Batch/Semester';
    END IF;
  ELSIF jsonb_array_length(p_items) <> 1 THEN
    RAISE EXCEPTION 'Specific Course scope must contain exactly one Course Assignment';
  END IF;

  INSERT INTO public.assessment_plans(
    title, assessment_type, scope_type,
    department_id, program_id, batch_id, semester_id,
    default_start_at, default_end_at, default_max_marks,
    instructions, status, created_by, published_at
  ) VALUES (
    btrim(p_title), p_assessment_type, p_scope_type,
    p_department_id, p_program_id, p_batch_id, p_semester_id,
    p_default_start_at, p_default_end_at, p_default_max_marks,
    nullif(btrim(coalesce(p_instructions, '')), ''),
    CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
    p_created_by,
    CASE WHEN p_publish THEN now() ELSE NULL END
  )
  RETURNING id INTO v_plan_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_course_assignment_id := (v_item->>'course_assignment_id')::uuid;
    v_starts_at := COALESCE((v_item->>'starts_at')::timestamptz, p_default_start_at);
    v_ends_at := COALESCE((v_item->>'ends_at')::timestamptz, p_default_end_at);
    v_max_marks := COALESCE((v_item->>'max_marks')::numeric, p_default_max_marks);

    IF v_ends_at <= v_starts_at OR v_max_marks <= 0 THEN
      RAISE EXCEPTION 'Invalid schedule item time or marks';
    END IF;

    SELECT ca.course_id, ca.teacher_id, c.name
      INTO v_course_id, v_teacher_id, v_course_name
    FROM public.course_assignments ca
    JOIN public.courses c ON c.id = ca.course_id
    JOIN public.academic_semesters s ON s.id = ca.semester_id
    JOIN public.academic_programs pr ON pr.id = s.program_id
    WHERE ca.id = v_course_assignment_id
      AND ca.batch_id = p_batch_id
      AND ca.semester_id = p_semester_id
      AND ca.status = 'active'
      AND ca.lifecycle_status = 'active'
      AND COALESCE(c.status, 'published') = 'published'
      AND pr.id = p_program_id
      AND pr.department_id = p_department_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Course Assignment % is not active in the selected academic scope', v_course_assignment_id;
    END IF;

    IF p_publish AND v_teacher_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: % has no teacher assigned', COALESCE(v_course_name, 'A course');
    END IF;

    INSERT INTO public.assessment_schedule_items(
      assessment_plan_id, course_assignment_id,
      starts_at, ends_at, max_marks
    ) VALUES (
      v_plan_id, v_course_assignment_id,
      v_starts_at, v_ends_at, v_max_marks
    )
    RETURNING id INTO v_item_id;

    v_items_created := v_items_created + 1;

    IF p_publish THEN
      INSERT INTO public.assessment_roster(
        schedule_item_id, enrollment_id, student_id
      )
      SELECT v_item_id, e.id, e.student_id
      FROM public.enrollments e
      JOIN public.profiles st ON st.id = e.student_id
      WHERE e.course_assignment_id = v_course_assignment_id
        AND e.status = 'active'
        AND st.role = 'student'
        AND st.is_active = true
      ON CONFLICT (schedule_item_id, student_id) DO NOTHING;
      GET DIAGNOSTICS v_target_count = ROW_COUNT;
      v_students_snapshotted := v_students_snapshotted + v_target_count;

      IF v_teacher_id IS NOT NULL THEN
        INSERT INTO public.notifications(
          user_id, title, body, type, course_id, course_assignment_id,
          assessment_schedule_item_id, action_url, metadata, created_by
        ) VALUES (
          v_teacher_id,
          'Assessment Scheduled',
          p_title || ' - ' || COALESCE(v_course_name, 'Course'),
          'assessment_schedule',
          v_course_id,
          v_course_assignment_id,
          v_item_id,
          '/assessments/' || v_item_id::text,
          jsonb_build_object(
            'recipient_role', 'teacher',
            'assessment_type', p_assessment_type,
            'starts_at', v_starts_at,
            'ends_at', v_ends_at,
            'max_marks', v_max_marks
          ),
          p_created_by
        );
        v_notifications_created := v_notifications_created + 1;
      END IF;

      INSERT INTO public.notifications(
        user_id, title, body, type, course_id, course_assignment_id,
        assessment_schedule_item_id, action_url, metadata, created_by
      )
      SELECT
        ar.student_id,
        'Assessment Scheduled',
        p_title || ' - ' || COALESCE(v_course_name, 'Course'),
        'assessment_schedule',
        v_course_id,
        v_course_assignment_id,
        v_item_id,
        '/assessments/' || v_item_id::text,
        jsonb_build_object(
          'recipient_role', 'student',
          'assessment_type', p_assessment_type,
          'starts_at', v_starts_at,
          'ends_at', v_ends_at,
          'max_marks', v_max_marks
        ),
        p_created_by
      FROM public.assessment_roster ar
      WHERE ar.schedule_item_id = v_item_id;
      GET DIAGNOSTICS v_target_count = ROW_COUNT;
      v_notifications_created := v_notifications_created + v_target_count;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'status', CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
    'items_created', v_items_created,
    'students_snapshotted', v_students_snapshotted,
    'notifications_created', v_notifications_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_assessment_plan(
  text, text, text, uuid, uuid, uuid, uuid,
  timestamptz, timestamptz, numeric, text, uuid, boolean, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_assessment_plan(
  text, text, text, uuid, uuid, uuid, uuid,
  timestamptz, timestamptz, numeric, text, uuid, boolean, jsonb
) TO service_role;

-- =========================================================
-- 8. PUBLISH AN EXISTING DRAFT
-- Roster is snapshotted at publication time, not draft-creation time.
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_publish_assessment_plan(
  p_plan_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_item record;
  v_course record;
  v_count integer := 0;
  v_students integer := 0;
  v_notifications integer := 0;
BEGIN
  SELECT * INTO v_plan
  FROM public.assessment_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment plan not found'; END IF;
  IF v_plan.status <> 'draft' THEN RAISE EXCEPTION 'Only draft assessments can be published'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessment_schedule_items i
    JOIN public.course_assignments ca ON ca.id = i.course_assignment_id
    WHERE i.assessment_plan_id = p_plan_id
      AND (ca.teacher_id IS NULL OR ca.status <> 'active' OR ca.lifecycle_status <> 'active')
  ) THEN
    RAISE EXCEPTION 'Every scheduled course must be active and have a current teacher before publishing';
  END IF;

  UPDATE public.assessment_plans
  SET status = 'published', published_at = now()
  WHERE id = p_plan_id;

  FOR v_item IN
    SELECT i.*, ca.course_id, ca.teacher_id, c.name AS course_name
    FROM public.assessment_schedule_items i
    JOIN public.course_assignments ca ON ca.id = i.course_assignment_id
    JOIN public.courses c ON c.id = ca.course_id
    WHERE i.assessment_plan_id = p_plan_id
  LOOP
    INSERT INTO public.assessment_roster(schedule_item_id, enrollment_id, student_id)
    SELECT v_item.id, e.id, e.student_id
    FROM public.enrollments e
    JOIN public.profiles st ON st.id = e.student_id
    WHERE e.course_assignment_id = v_item.course_assignment_id
      AND e.status = 'active'
      AND st.role = 'student'
      AND st.is_active = true
    ON CONFLICT (schedule_item_id, student_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_students := v_students + v_count;

    INSERT INTO public.notifications(
      user_id, title, body, type, course_id, course_assignment_id,
      assessment_schedule_item_id, action_url, metadata, created_by
    ) VALUES (
      v_item.teacher_id,
      'Assessment Scheduled',
      v_plan.title || ' - ' || v_item.course_name,
      'assessment_schedule',
      v_item.course_id,
      v_item.course_assignment_id,
      v_item.id,
      '/assessments/' || v_item.id::text,
      jsonb_build_object(
        'recipient_role', 'teacher',
        'assessment_type', v_plan.assessment_type,
        'starts_at', v_item.starts_at,
        'ends_at', v_item.ends_at,
        'max_marks', v_item.max_marks
      ),
      p_admin_id
    );
    v_notifications := v_notifications + 1;

    INSERT INTO public.notifications(
      user_id, title, body, type, course_id, course_assignment_id,
      assessment_schedule_item_id, action_url, metadata, created_by
    )
    SELECT
      ar.student_id,
      'Assessment Scheduled',
      v_plan.title || ' - ' || v_item.course_name,
      'assessment_schedule',
      v_item.course_id,
      v_item.course_assignment_id,
      v_item.id,
      '/assessments/' || v_item.id::text,
      jsonb_build_object(
        'recipient_role', 'student',
        'assessment_type', v_plan.assessment_type,
        'starts_at', v_item.starts_at,
        'ends_at', v_item.ends_at,
        'max_marks', v_item.max_marks
      ),
      p_admin_id
    FROM public.assessment_roster ar
    WHERE ar.schedule_item_id = v_item.id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_notifications := v_notifications + v_count;
  END LOOP;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'status', 'published',
    'students_snapshotted', v_students,
    'notifications_created', v_notifications
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_assessment_plan(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_assessment_plan(uuid, uuid) TO service_role;

-- =========================================================
-- 9. CANCEL PLAN + SEND UPDATE NOTIFICATIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_cancel_assessment_plan(
  p_plan_id uuid,
  p_reason text,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_item record;
  v_count integer := 0;
  v_notifications integer := 0;
BEGIN
  SELECT * INTO v_plan
  FROM public.assessment_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment plan not found'; END IF;
  IF v_plan.status = 'cancelled' THEN RAISE EXCEPTION 'Assessment is already cancelled'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.assessment_schedule_items
    WHERE assessment_plan_id = p_plan_id
      AND result_status = 'completed'
  ) THEN
    RAISE EXCEPTION 'A plan with completed course results cannot be cancelled';
  END IF;

  UPDATE public.assessment_plans
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = nullif(btrim(coalesce(p_reason,'')), '')
  WHERE id = p_plan_id;

  UPDATE public.assessment_schedule_items
  SET result_status = 'cancelled', cancelled_at = now(), cancellation_reason = nullif(btrim(coalesce(p_reason,'')), '')
  WHERE assessment_plan_id = p_plan_id
    AND result_status <> 'completed';

  IF v_plan.status = 'published' THEN
    FOR v_item IN
      SELECT i.id, i.course_assignment_id, ca.course_id, ca.teacher_id, c.name AS course_name
      FROM public.assessment_schedule_items i
      JOIN public.course_assignments ca ON ca.id = i.course_assignment_id
      JOIN public.courses c ON c.id = ca.course_id
      WHERE i.assessment_plan_id = p_plan_id
    LOOP
      IF v_item.teacher_id IS NOT NULL THEN
        INSERT INTO public.notifications(
          user_id, title, body, type, course_id, course_assignment_id,
          assessment_schedule_item_id, action_url, metadata, created_by
        ) VALUES (
          v_item.teacher_id,
          'Assessment Cancelled',
          v_plan.title || ' - ' || v_item.course_name,
          'assessment_cancelled',
          v_item.course_id,
          v_item.course_assignment_id,
          v_item.id,
          '/assessments/' || v_item.id::text,
          jsonb_build_object('recipient_role','teacher','reason',p_reason),
          p_admin_id
        );
        v_notifications := v_notifications + 1;
      END IF;

      INSERT INTO public.notifications(
        user_id, title, body, type, course_id, course_assignment_id,
        assessment_schedule_item_id, action_url, metadata, created_by
      )
      SELECT
        ar.student_id,
        'Assessment Cancelled',
        v_plan.title || ' - ' || v_item.course_name,
        'assessment_cancelled',
        v_item.course_id,
        v_item.course_assignment_id,
        v_item.id,
        '/assessments/' || v_item.id::text,
        jsonb_build_object('recipient_role','student','reason',p_reason),
        p_admin_id
      FROM public.assessment_roster ar
      WHERE ar.schedule_item_id = v_item.id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_notifications := v_notifications + v_count;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'status', 'cancelled',
    'notifications_created', v_notifications
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_assessment_plan(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_assessment_plan(uuid, text, uuid) TO service_role;

-- =========================================================
-- 10. TEACHER REPLACEMENT -> CURRENT SCHEDULE NOTIFICATION
-- The schedule stays linked to the stable Course Assignment. Old teacher loses
-- current-card access through teacher_current_course_access; new teacher is notified.
-- =========================================================

CREATE OR REPLACE FUNCTION public.notify_replacement_teacher_assessments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.teacher_id IS NOT DISTINCT FROM NEW.teacher_id OR NEW.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications(
    user_id, title, body, type, course_id, course_assignment_id,
    assessment_schedule_item_id, action_url, metadata
  )
  SELECT
    NEW.teacher_id,
    'Assessment Schedule Assigned',
    ap.title || ' - ' || COALESCE(c.name, 'Course'),
    'assessment_schedule',
    NEW.course_id,
    NEW.id,
    asi.id,
    '/assessments/' || asi.id::text,
    jsonb_build_object(
      'recipient_role', 'teacher',
      'assessment_type', ap.assessment_type,
      'teacher_reassigned', true,
      'starts_at', asi.starts_at,
      'ends_at', asi.ends_at,
      'max_marks', asi.max_marks
    )
  FROM public.assessment_schedule_items asi
  JOIN public.assessment_plans ap ON ap.id = asi.assessment_plan_id
  LEFT JOIN public.courses c ON c.id = NEW.course_id
  WHERE asi.course_assignment_id = NEW.id
    AND ap.status = 'published'
    AND asi.result_status IN ('pending','prepared','in_progress','result_pending');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_assignment_assessment_teacher_change
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignment_assessment_teacher_change
AFTER UPDATE OF teacher_id ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_replacement_teacher_assessments();

-- =========================================================
-- 11. GRADEBOOK CONTEXT COMPATIBILITY
-- Preserve legacy behavior, but carry exact Course Assignment when available.
-- =========================================================

CREATE OR REPLACE FUNCTION public.sync_quiz_to_gradebook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.gradebook_components(
    course_id, course_assignment_id, category, name, max_marks, source_type, source_id
  ) VALUES (
    NEW.course_id, NEW.course_assignment_id, 'quiz', NEW.title, NEW.total_marks,
    'digital_quiz', NEW.id
  )
  ON CONFLICT (source_type, source_id) WHERE source_type <> 'manual'
  DO UPDATE SET
    course_assignment_id = COALESCE(EXCLUDED.course_assignment_id, public.gradebook_components.course_assignment_id),
    name = EXCLUDED.name,
    max_marks = EXCLUDED.max_marks;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_assignment_to_gradebook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.gradebook_components(
    course_id, course_assignment_id, category, name, max_marks, source_type, source_id
  ) VALUES (
    NEW.course_id, NEW.course_assignment_id, 'assignment', NEW.title, NEW.total_marks,
    'digital_assignment', NEW.id
  )
  ON CONFLICT (source_type, source_id) WHERE source_type <> 'manual'
  DO UPDATE SET
    course_assignment_id = COALESCE(EXCLUDED.course_assignment_id, public.gradebook_components.course_assignment_id),
    name = EXCLUDED.name,
    max_marks = EXCLUDED.max_marks;
  RETURN NEW;
END;
$$;

-- Quiz notification is Course Assignment-aware when new code supplies that ID.
-- Legacy quizzes without course_assignment_id keep the previous course-based fallback.
CREATE OR REPLACE FUNCTION public.notify_new_quiz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(
    user_id, title, body, type, is_read, created_at,
    course_id, course_assignment_id
  )
  SELECT
    e.student_id,
    'New Quiz Posted',
    'A new quiz "' || NEW.title || '" has been added to your course.',
    'quiz',
    false,
    now(),
    NEW.course_id,
    NEW.course_assignment_id
  FROM public.enrollments e
  WHERE e.status = 'active'
    AND (
      (NEW.course_assignment_id IS NOT NULL AND e.course_assignment_id = NEW.course_assignment_id)
      OR
      (NEW.course_assignment_id IS NULL AND e.course_id = NEW.course_id)
    );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
