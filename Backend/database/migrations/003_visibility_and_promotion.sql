-- CampusZ LMS - visibility, promotion and current-course behavior
-- Run AFTER 001_course_assignments.sql and 002_permanent_roll_numbers.sql.
-- This migration preserves historical enrollments while ensuring promoted
-- students no longer see previous-semester regular courses as current courses.

BEGIN;

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
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'reason', 'Student is already in the target semester'
      ));
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

    -- Close the historical academic placement.
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

    -- IMPORTANT: Promotion never mutates or deletes existing enrollments.
    -- Previous-semester regular enrollments remain exactly as they were so
    -- the student and admin can still open the full historical course data
    -- (attendance, submissions, marks, materials, etc.). Current-course APIs
    -- decide visibility by comparing the enrollment semester with the
    -- student's CURRENT profiles.semester_id. Supply enrollments are also
    -- preserved and may remain visible while the student is in a later semester.

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
