-- CampusZ LMS - reusable academic structure
-- Departments, Programs and Semesters are master data. A Batch selects Programs
-- through academic_batch_programs and stores intake-specific placement there.

BEGIN;

-- Keep this legacy column during the transition because older builds may still
-- read it. New writes must not use it to decide Batch membership.
ALTER TABLE public.academic_departments
  ALTER COLUMN batch_id DROP NOT NULL;

COMMENT ON COLUMN public.academic_departments.batch_id IS
  'Deprecated compatibility column. Batch membership is stored in academic_batch_programs.';

CREATE TABLE IF NOT EXISTS public.academic_batch_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL
    CONSTRAINT academic_batch_programs_batch_id_fkey
    REFERENCES public.academic_batches(id) ON DELETE CASCADE,
  program_id uuid NOT NULL
    CONSTRAINT academic_batch_programs_program_id_fkey
    REFERENCES public.academic_programs(id) ON DELETE CASCADE,
  admission_type text NOT NULL DEFAULT 'regular'
    CHECK (admission_type IN ('regular', 'lateral', 'transfer', 'legacy')),
  entry_semester_id uuid
    CONSTRAINT academic_batch_programs_entry_semester_id_fkey
    REFERENCES public.academic_semesters(id) ON DELETE SET NULL,
  current_semester_id uuid
    CONSTRAINT academic_batch_programs_current_semester_id_fkey
    REFERENCES public.academic_semesters(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_batch_programs_batch_program_key
    UNIQUE (batch_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_academic_batch_programs_batch_status
  ON public.academic_batch_programs(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_academic_batch_programs_program
  ON public.academic_batch_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_academic_batch_programs_current_semester
  ON public.academic_batch_programs(current_semester_id);

COMMENT ON TABLE public.academic_batch_programs IS
  'Batch-specific Program offering. Entry semester is fixed for an intake; current semester advances through promotion.';

-- Existing Department -> Batch data is preserved as a legacy Program mapping.
-- Entry/current placement is deliberately left empty because guessing it would
-- misclassify lateral and transfer intakes. Admin can configure it in the UI.
INSERT INTO public.academic_batch_programs (
  batch_id,
  program_id,
  admission_type,
  entry_semester_id,
  current_semester_id,
  status
)
SELECT DISTINCT
  d.batch_id,
  p.id,
  'legacy',
  NULL::uuid,
  NULL::uuid,
  CASE
    WHEN COALESCE(d.status, 'active') = 'active'
     AND COALESCE(p.status, 'active') = 'active'
    THEN 'active'
    ELSE 'inactive'
  END
FROM public.academic_departments d
JOIN public.academic_programs p ON p.department_id = d.id
WHERE d.batch_id IS NOT NULL
ON CONFLICT (batch_id, program_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_academic_batch_program()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry_number integer;
  v_current_number integer;
BEGIN
  IF NEW.entry_semester_id IS NOT NULL THEN
    SELECT semester_number INTO v_entry_number
    FROM public.academic_semesters
    WHERE id = NEW.entry_semester_id
      AND program_id = NEW.program_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entry semester does not belong to the selected program';
    END IF;
  END IF;

  IF NEW.current_semester_id IS NOT NULL THEN
    SELECT semester_number INTO v_current_number
    FROM public.academic_semesters
    WHERE id = NEW.current_semester_id
      AND program_id = NEW.program_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Current semester does not belong to the selected program';
    END IF;
  END IF;

  IF v_entry_number IS NOT NULL
     AND v_current_number IS NOT NULL
     AND v_current_number < v_entry_number THEN
    RAISE EXCEPTION 'Current semester cannot be earlier than entry semester';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_academic_batch_program
  ON public.academic_batch_programs;
CREATE TRIGGER trg_validate_academic_batch_program
BEFORE INSERT OR UPDATE ON public.academic_batch_programs
FOR EACH ROW EXECUTE FUNCTION public.validate_academic_batch_program();

-- Existing operational tables keep their current columns. These triggers only
-- replace the old Department.batch_id assumption when a new context is saved.
CREATE OR REPLACE FUNCTION public.validate_batch_program_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_program_id uuid;
  v_semester_number integer;
  v_entry_number integer;
BEGIN
  SELECT program_id, semester_number
  INTO v_program_id, v_semester_number
  FROM public.academic_semesters
  WHERE id = NEW.semester_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected Semester not found';
  END IF;

  IF TG_TABLE_NAME = 'assessment_plans' THEN
    IF NEW.program_id IS DISTINCT FROM v_program_id THEN
      RAISE EXCEPTION 'Selected Semester does not belong to the selected Program';
    END IF;
  END IF;

  SELECT entry_semester.semester_number
  INTO v_entry_number
  FROM public.academic_batch_programs abp
  LEFT JOIN public.academic_semesters entry_semester
    ON entry_semester.id = abp.entry_semester_id
  WHERE abp.batch_id = NEW.batch_id
    AND abp.program_id = v_program_id
    AND abp.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected Program is not configured in the selected Batch';
  END IF;

  IF v_entry_number IS NOT NULL AND v_semester_number < v_entry_number THEN
    RAISE EXCEPTION 'Selected Semester is earlier than the intake entry Semester';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_assignment_batch_program_insert
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignment_batch_program_insert
BEFORE INSERT ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_program_context();

DROP TRIGGER IF EXISTS trg_course_assignment_batch_program_update
  ON public.course_assignments;
CREATE TRIGGER trg_course_assignment_batch_program_update
BEFORE UPDATE OF batch_id, semester_id ON public.course_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_program_context();

DROP TRIGGER IF EXISTS trg_assessment_plan_batch_program_insert
  ON public.assessment_plans;
CREATE TRIGGER trg_assessment_plan_batch_program_insert
BEFORE INSERT ON public.assessment_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_program_context();

DROP TRIGGER IF EXISTS trg_assessment_plan_batch_program_update
  ON public.assessment_plans;
CREATE TRIGGER trg_assessment_plan_batch_program_update
BEFORE UPDATE OF batch_id, program_id, semester_id ON public.assessment_plans
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_program_context();

-- One transaction saves both the Batch and all selected Programs. Programs
-- removed in an edit are deactivated so historical student/course rows remain
-- valid and can be restored later.
CREATE OR REPLACE FUNCTION public.admin_save_academic_batch(
  p_batch_id uuid,
  p_start_year integer,
  p_end_year integer,
  p_status text,
  p_programs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_item jsonb;
  v_program_id uuid;
  v_entry_semester_id uuid;
  v_current_semester_id uuid;
  v_admission_type text;
  v_mapping_status text;
  v_program_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_start_year IS NULL OR p_end_year IS NULL OR p_end_year < p_start_year THEN
    RAISE EXCEPTION 'A valid Batch start and end year is required';
  END IF;

  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid Batch status';
  END IF;

  IF p_programs IS NULL
     OR jsonb_typeof(p_programs) <> 'array'
     OR jsonb_array_length(p_programs) = 0 THEN
    RAISE EXCEPTION 'At least one Program is required for a Batch';
  END IF;

  IF p_batch_id IS NULL THEN
    INSERT INTO public.academic_batches(start_year, end_year, status)
    VALUES (p_start_year, p_end_year, p_status)
    RETURNING id INTO v_batch_id;
  ELSE
    UPDATE public.academic_batches
    SET start_year = p_start_year,
        end_year = p_end_year,
        status = p_status,
        updated_at = now()
    WHERE id = p_batch_id
    RETURNING id INTO v_batch_id;

    IF v_batch_id IS NULL THEN
      RAISE EXCEPTION 'Batch not found';
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_programs)
  LOOP
    v_program_id := (v_item->>'program_id')::uuid;
    v_entry_semester_id := NULLIF(v_item->>'entry_semester_id', '')::uuid;
    v_current_semester_id := NULLIF(v_item->>'current_semester_id', '')::uuid;
    v_admission_type := lower(COALESCE(NULLIF(v_item->>'admission_type', ''), 'regular'));
    v_mapping_status := lower(COALESCE(NULLIF(v_item->>'status', ''), 'active'));

    IF v_admission_type NOT IN ('regular', 'lateral', 'transfer', 'legacy') THEN
      RAISE EXCEPTION 'Invalid admission type';
    END IF;
    IF v_mapping_status NOT IN ('active', 'inactive') THEN
      RAISE EXCEPTION 'Invalid Batch Program status';
    END IF;
    IF v_admission_type <> 'legacy'
       AND (v_entry_semester_id IS NULL OR v_current_semester_id IS NULL) THEN
      RAISE EXCEPTION 'Entry semester and current semester are required';
    END IF;

    IF v_program_id = ANY(v_program_ids) THEN
      RAISE EXCEPTION 'A Program cannot be selected twice in the same Batch';
    END IF;
    v_program_ids := array_append(v_program_ids, v_program_id);

    IF NOT EXISTS (
      SELECT 1 FROM public.academic_programs WHERE id = v_program_id
    ) THEN
      RAISE EXCEPTION 'Selected Program not found';
    END IF;
    IF v_mapping_status = 'active' AND NOT EXISTS (
      SELECT 1
      FROM public.academic_programs p
      JOIN public.academic_departments d ON d.id = p.department_id
      WHERE p.id = v_program_id
        AND p.status = 'active'
        AND d.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Selected Program and Department must be active';
    END IF;
    IF v_mapping_status = 'active' AND (
      NOT EXISTS (
        SELECT 1 FROM public.academic_semesters
        WHERE id = v_entry_semester_id AND status = 'active'
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.academic_semesters
        WHERE id = v_current_semester_id AND status = 'active'
      )
    ) AND v_admission_type <> 'legacy' THEN
      RAISE EXCEPTION 'Entry and current Semesters must be active';
    END IF;

    INSERT INTO public.academic_batch_programs (
      batch_id,
      program_id,
      admission_type,
      entry_semester_id,
      current_semester_id,
      status
    ) VALUES (
      v_batch_id,
      v_program_id,
      v_admission_type,
      v_entry_semester_id,
      v_current_semester_id,
      v_mapping_status
    )
    ON CONFLICT (batch_id, program_id)
    DO UPDATE SET
      admission_type = EXCLUDED.admission_type,
      entry_semester_id = EXCLUDED.entry_semester_id,
      current_semester_id = EXCLUDED.current_semester_id,
      status = EXCLUDED.status,
      updated_at = now();
  END LOOP;

  UPDATE public.academic_batch_programs
  SET status = 'inactive', updated_at = now()
  WHERE batch_id = v_batch_id
    AND NOT (program_id = ANY(v_program_ids));

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_academic_batch(uuid, integer, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_academic_batch(uuid, integer, integer, text, jsonb) TO service_role;

-- Roll-number validation now uses the Program offering instead of the legacy
-- Department.batch_id column. The public signature and output format stay the same.
CREATE OR REPLACE FUNCTION public.generate_student_roll_no(
  p_department_id uuid,
  p_program_id uuid,
  p_batch_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_code text;
  v_program_code text;
  v_batch_year integer;
  v_prefix text;
  v_next integer;
BEGIN
  SELECT
    upper(regexp_replace(coalesce(nullif(d.code, ''), d.name), '[^A-Za-z0-9]', '', 'g')),
    upper(regexp_replace(coalesce(nullif(p.code, ''), p.name), '[^A-Za-z0-9]', '', 'g')),
    b.start_year
  INTO v_department_code, v_program_code, v_batch_year
  FROM public.academic_batch_programs abp
  JOIN public.academic_batches b ON b.id = abp.batch_id
  JOIN public.academic_programs p ON p.id = abp.program_id
  JOIN public.academic_departments d ON d.id = p.department_id
  WHERE abp.batch_id = p_batch_id
    AND abp.program_id = p_program_id
    AND d.id = p_department_id
    AND abp.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid Batch, Department or Program combination';
  END IF;

  v_department_code := left(v_department_code, 2);
  v_program_code := left(v_program_code, 2);
  v_prefix := 'S' || v_department_code || v_program_code || right(v_batch_year::text, 2);

  INSERT INTO public.roll_number_counters(prefix, last_number)
  VALUES (v_prefix, 1)
  ON CONFLICT (prefix)
  DO UPDATE SET last_number = public.roll_number_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_prefix || lpad(v_next::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_student_roll_no(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_student_roll_no(uuid, uuid, uuid) TO service_role;

ALTER TABLE public.academic_batch_programs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.academic_batch_programs TO authenticated;
GRANT ALL ON TABLE public.academic_batch_programs TO service_role;
DROP POLICY IF EXISTS academic_batch_programs_read_active
  ON public.academic_batch_programs;
CREATE POLICY academic_batch_programs_read_active
ON public.academic_batch_programs
FOR SELECT TO authenticated
USING (status = 'active');

NOTIFY pgrst, 'reload schema';
COMMIT;
