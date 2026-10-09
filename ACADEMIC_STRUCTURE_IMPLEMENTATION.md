# Academic Structure Implementation

## Final model

- `academic_departments`, `academic_programs`, and `academic_semesters` are reusable master data.
- `academic_batches` still stores the Batch start/end year and status.
- `academic_batch_programs` stores which existing Programs run in a Batch.
- Department membership is derived from each selected Program.
- `entry_semester_id` is the intake's fixed starting point.
- `current_semester_id` is the cohort's present semester and can advance later.

## Deployment order

1. Back up the Supabase database.
2. Run `Admin Panel Beckend/database/migrations/007_batch_program_academic_structure.sql`.
3. Deploy the updated backend.
4. Deploy the updated Admin Panel frontend.
5. Open **Academic Structure → Batches** and edit every row marked **Needs setup**.

The migration backfills old `Department.batch_id` relationships as `legacy` Program mappings. It intentionally does not guess entry/current Semester, because doing that could incorrectly classify lateral or transfer intakes.

## Compatibility

- Student and Teacher mobile-app tables are unchanged.
- `profiles`, `courses`, `course_assignments`, `enrollments`, promotion history, and assessment tables retain their existing columns.
- Existing API calls that request Departments by `batch_id` still work; the backend now derives them through Batch Programs.
- New Course Assignments and Assessment Plans are checked against the selected Batch Program mapping.
- A full-cohort promotion advances the mapping's current Semester; partial or mixed promotions leave the cohort pointer unchanged.
- The permanent roll-number function keeps the same signature and format, but validates against `academic_batch_programs`.
- `academic_departments.batch_id` is retained as a deprecated compatibility column. New Department writes do not populate it.

## Admin workflow

1. Create a Department once.
2. Create Programs under that Department.
3. Create reusable Semesters under each Program.
4. Create a Batch with the wizard:
   - Batch dates
   - Department filters
   - Program selection
   - Admission type, entry Semester, and current Semester
   - Review and save

Removing a Program from a Batch deactivates its mapping instead of deleting historical student/course data. Its current students and Course Assignments are academically blocked, while restoring the mapping recomputes their normal access.

## Out of scope

The Excel import definition and backend student-import mapping still use the legacy import flow and were intentionally not changed in this implementation.
