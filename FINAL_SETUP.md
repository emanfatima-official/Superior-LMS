# CampusZ LMS - Final Setup

This build continues from the current LMS codebase and current Supabase schema.

## 1) Database
Your current schema already contains the earlier Course Assignment / history / gradebook migrations.
Run this file **once** in Supabase SQL Editor:

`RUN_THIS_FINAL_005_SQL.sql`

This migration finalizes:
- Course + Batch + Semester planning with optional Teacher
- Promotion -> previous Regular enrollments become `completed` (history is preserved)
- Current student/teacher course-access views
- Reversible Active / Inactive access lifecycle
- Completed read-only academic lifecycle
- Student academic blocking from inactive academic structure
- Teacher access through Course Assignments only (teachers are not academic-structure members)
- Hard-delete cascade rules used by the Admin Panel

## 2) Backend
```bash
cd "Admin Panel Beckend"
npm install
npm run dev
```
Copy `.env.example` to `.env` and use your own Supabase/SMTP values. The ZIP intentionally does not contain `.env` secrets.

## 3) Frontend
```bash
cd "Admin panel Frontend/admin-panel"
npm install
npm run dev
```

## Lifecycle rules
- Active: current access allowed.
- Inactive: reversible; data/history remains.
- Completed: finished academic context, history/result access only.
- Delete: permanent hard delete after Admin warning/confirmation.
- Promotion never deletes old course history.
- A Course can be scheduled for Batch + Semester before a Teacher is assigned.
