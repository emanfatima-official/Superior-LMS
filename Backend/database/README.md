# Database migrations

Run these migrations in Supabase SQL Editor in order:

1. `001_course_assignments.sql` – Generic Course, Course Assignment, teacher history, enrollment context, activity context, attendance sessions, student academic history and promotion RPC.
2. `002_permanent_roll_numbers.sql` – Permanent roll numbers: `S + Dept(2) + Program(2) + BatchYY + 3-digit counter`, with no semester in the roll number.
3. `003_visibility_and_promotion.sql` – Updates the promotion RPC so previous academic placement is closed in `student_academic_history`, while existing enrollment/course activity rows are left untouched. Current regular courses are filtered by the student's current semester; previous semesters remain available as history.

All migrations retain existing historical records and legacy compatibility columns.

## Migration 004
Run `migrations/004_runtime_history_gradebook_exports.sql` after 001-003. It fixes Course Assignment context on quizzes/gradebook records, restores `gradebook_components`, preserves old enrollments as history while closing previous regular semester enrollments, and adds announcement attachment metadata.

## Migration 005 – Admin Assessment Scheduling
Run `migrations/005_assessment_scheduling.sql` after the live schema is up to date. It adds:

- `assessment_plans`
- `assessment_schedule_items`
- `assessment_roster`
- Course Assignment-aware assessment notifications
- Teacher/Student current-access RLS for schedule cards
- atomic create/publish/cancel assessment RPCs
- teacher-replacement schedule notification
- exact Course Assignment propagation into Quiz/Assignment gradebook components

This migration is additive. Existing Quiz/Assignment tables remain the operational content tables used by Teacher/Student apps.
