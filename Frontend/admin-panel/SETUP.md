# Setup Instructions

## 1. Install dependencies

```bash
npm install
```

(If you ever see a "Cannot find native binding" error from a previous broken
install, run `rm -rf node_modules package-lock.json && npm install` first.)

## 2. Configure the API URL

```bash
cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:5000/api
```

## 3. Run the backend

In `Admin Panel Beckend/`, with your Supabase `.env` set:

```bash
npm install
npm start   # or: node app.js
```

Listens on port 5000 by default.

## 4. Run the frontend

```bash
npm run dev
```

## What's fully wired up now

Every module in the sidebar is a real, working page connected to your
existing backend — nothing here touches the backend code:

- **Dashboard** (`/dashboard`) — live stat cards, recent activity feed,
  weekly enrollment chart, top courses, and Quick Action modals, all backed
  by `/api/teachers`, `/api/students`, `/api/courses`, `/api/enrollments`.
  Stat cards and "View all" links now navigate to their respective pages.
- **Teachers** (`/teachers`) — list with search, Add Teacher, Edit, Reset
  Password, and Delete — all calling the real teacher endpoints.
- **Students** (`/students`) — list with search, Add Student, Edit, and
  Delete.
- **Courses** (`/courses`) — list with search, showing each course's
  assigned teacher (resolved from `/api/teachers`), Add Course, Edit, and
  Delete.
- **Enrollments** (`/enrollments`) — list with student/course search and a
  course filter, resolving names from `/api/students` and `/api/courses`,
  bulk "Enroll Students", and unenroll (delete).
- **Notification bell** (top right) — pulls the same recent-activity feed
  (new teachers/students/courses/enrollments) into a real dropdown with an
  unread-count badge, tracked via a local "last seen" timestamp. No backend
  notifications endpoint exists, so this is derived client-side from your
  existing list endpoints — it is not a mock.

Sidebar links no longer show "Coming soon" — all five routes are real pages
guarded by `ProtectedRoute`/`AuthContext`.
