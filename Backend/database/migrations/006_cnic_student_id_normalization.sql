BEGIN;

-- =====================================================
-- CAMPUSZ - IDENTITY UPDATE
-- Student:
--   Father Name
--   Manual Student ID
-- Student + Teacher:
--   CNIC username
--   Optional email
-- =====================================================

-- 1. Father Name
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS father_name text;

-- 2. Email is now optional
ALTER TABLE public.profiles
ALTER COLUMN email DROP NOT NULL;

-- Empty values -> NULL
UPDATE public.profiles
SET email = NULL
WHERE email IS NOT NULL
  AND btrim(email) = '';

UPDATE public.profiles
SET cnic = NULL
WHERE cnic IS NOT NULL
  AND btrim(cnic) = '';

UPDATE public.profiles
SET student_id = NULL
WHERE student_id IS NOT NULL
  AND btrim(student_id) = '';

-- 3. Normalize CNIC
UPDATE public.profiles
SET cnic = regexp_replace(cnic, '[^0-9]', '', 'g')
WHERE cnic IS NOT NULL;

-- =====================================================
-- DUPLICATE CHECKS
-- =====================================================

DO $$
DECLARE
  duplicate_cnic text;
BEGIN

  SELECT cnic
  INTO duplicate_cnic
  FROM public.profiles
  WHERE cnic IS NOT NULL
  GROUP BY cnic
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_cnic IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate CNIC exists: %. Fix it before continuing.',
      duplicate_cnic;
  END IF;

END $$;


DO $$
DECLARE
  duplicate_student_id text;
BEGIN

  SELECT student_id
  INTO duplicate_student_id
  FROM public.profiles
  WHERE role = 'student'
    AND student_id IS NOT NULL
  GROUP BY student_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_student_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate Student ID exists: %. Fix it before continuing.',
      duplicate_student_id;
  END IF;

END $$;

-- =====================================================
-- CNIC VALIDATION
-- =====================================================

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_cnic_13_digits_chk;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_cnic_13_digits_chk
CHECK (
  cnic IS NULL
  OR cnic ~ '^[0-9]{13}$'
);

-- CNIC globally unique for students + teachers
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnic_unique_idx
ON public.profiles(cnic)
WHERE cnic IS NOT NULL;

-- Student ID unique among students
CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_unique_idx
ON public.profiles(student_id)
WHERE role = 'student'
  AND student_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.cnic IS
'13-digit normalized CNIC/B-Form. Used as Student/Teacher login username.';

COMMENT ON COLUMN public.profiles.email IS
'Optional contact email. Student/Teacher login does not use this email.';

COMMENT ON COLUMN public.profiles.student_id IS
'University Student ID manually entered/imported by admin.';

COMMENT ON COLUMN public.profiles.father_name IS
'Father name for student profile.';

NOTIFY pgrst, 'reload schema';

COMMIT;