# Exams & Assessments – Phase 1

Implemented against the uploaded live Supabase schema/security export.

## Database
- Added `assessment_plans`, `assessment_schedule_items`, `assessment_roster`.
- Added notification context: `course_assignment_id`, `assessment_schedule_item_id`, `action_url`, `metadata`.
- Added current-access RLS so promoted students and completed-course teachers do not see old schedule cards.
- Added atomic admin RPCs for create/publish/cancel.
- Added teacher replacement notification for active assessment schedules.
- Preserved existing `quizzes` and `assignments`; gradebook sync now carries `course_assignment_id` when available.

## Backend
New `/api/assessments` module supports:
- list/detail
- exact Course Assignment options
- conflict preview
- create as Draft or Publish
- publish Draft
- cancel with notification

Promotion now checks active assessment blockers before promoting selected students.

## Admin Frontend
Added **Exams & Assessments** sidebar/page with:
- Department → Program → Batch → Semester filters
- Entire Semester / Specific Course targeting
- Quiz / Assignment / Mid
- course-wise preview
- per-course time/marks adjustment
- teacher/student conflict checking
- Save Draft / Publish
- cancel flow

## Run order
1. Run `RUN_ASSESSMENT_SCHEDULING.sql` in Supabase SQL Editor.
2. Restart Admin backend.
3. Restart Admin frontend.
4. Open **Exams & Assessments** from the sidebar.
