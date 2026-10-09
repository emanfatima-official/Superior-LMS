-- CampusZ LMS - permanent roll numbers
-- Final format: S + DeptCode(2) + ProgramCode(2) + BatchYY + 3-digit counter
-- Example: SINCS26004
-- Semester is intentionally NOT included, so promotion never changes roll_no.

BEGIN;

-- Remove legacy overloads that included semester/section parameters.
DROP FUNCTION IF EXISTS public.generate_student_roll_no(uuid, uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.generate_student_roll_no(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.generate_student_roll_no(uuid, uuid, uuid);

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
  INTO
    v_department_code,
    v_program_code,
    v_batch_year
  FROM public.academic_departments d
  JOIN public.academic_programs p
    ON p.id = p_program_id
   AND p.department_id = d.id
  JOIN public.academic_batches b
    ON b.id = p_batch_id
  WHERE d.id = p_department_id
    AND d.batch_id = p_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid Batch, Department or Program combination';
  END IF;

  IF v_batch_year IS NULL THEN
    RAISE EXCEPTION 'Batch start year is required to generate roll number';
  END IF;

  -- Keep roll number compact. The first two alphanumeric characters of the
  -- Department and Program codes/names are used.
  v_department_code := left(v_department_code, 2);
  v_program_code := left(v_program_code, 2);

  IF length(v_department_code) < 1 OR length(v_program_code) < 1 THEN
    RAISE EXCEPTION 'Department and Program codes are required to generate roll number';
  END IF;

  v_prefix :=
    'S' ||
    v_department_code ||
    v_program_code ||
    right(v_batch_year::text, 2);

  -- One independent counter per Batch + Department + Program prefix.
  INSERT INTO public.roll_number_counters(prefix, last_number)
  VALUES (v_prefix, 1)
  ON CONFLICT (prefix)
  DO UPDATE SET last_number = public.roll_number_counters.last_number + 1
  RETURNING last_number INTO v_next;

  -- LPAD(3) gives 001, 002 ... 999. PostgreSQL naturally returns 1000,
  -- 1001, etc. if a cohort ever exceeds 999 students.
  RETURN v_prefix || lpad(v_next::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_student_roll_no(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_student_roll_no(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.generate_student_roll_no(uuid, uuid, uuid) IS
  'Permanent semester-independent student roll number. Format S + Dept(2) + Program(2) + BatchYY + 3-digit counter.';

NOTIFY pgrst, 'reload schema';
COMMIT;
