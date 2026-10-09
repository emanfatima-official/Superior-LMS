require(
  "dotenv"
).config();

const express =
  require(
    "express"
  );

const cors =
  require(
    "cors"
  );

const authRoutes =
  require(
    "./routes/auth.routes"
  );

const teacherRoutes =
  require(
    "./routes/teacher.routes"
  );

const courseRoutes =
  require(
    "./routes/course.routes"
  );

const studentRoutes =
  require(
    "./routes/student.routes"
  );

const enrollmentRoutes =
  require(
    "./routes/enrollment.routes"
  );

const uploadRoutes =
  require(
    "./routes/upload.routes"
  );

const academicStructureRoutes =
  require(
    "./routes/academicStructure.routes"
  );

const activityLogRoutes =
  require(
    "./routes/activityLog.routes"
  );

const courseAssignmentRoutes =
  require(
    "./routes/courseAssignment.routes"
  );

const promotionRoutes =
  require(
    "./routes/promotion.routes"
  );

const historyRoutes =
  require(
    "./routes/history.routes"
  );

const adminNotificationRoutes =
  require(
    "./routes/adminNotification.routes"
  );

const assessmentRoutes =
  require(
    "./routes/assessment.routes"
  );

const attendanceRoutes =
  require(
    "./routes/attendance.routes"
  );

const activityLogger =
  require(
    "./middleware/activityLogger"
  );

const app =
  express();

// ======================================================
// GLOBAL MIDDLEWARE
// ======================================================

app.use(
  cors()
);

// Bulk import validation can contain up to 2,000 rows.
app.use(
  express.json({
    limit:
      "10mb",
  })
);

// Activity logger must run before API routes.
app.use(
  "/api",
  activityLogger
);

// ======================================================
// API ROUTES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/teachers",
  teacherRoutes
);

app.use(
  "/api/courses",
  courseRoutes
);

app.use(
  "/api/course-assignments",
  courseAssignmentRoutes
);

app.use(
  "/api/students",
  studentRoutes
);

app.use(
  "/api/enrollments",
  enrollmentRoutes
);

app.use(
  "/api/promotions",
  promotionRoutes
);

app.use(
  "/api/history",
  historyRoutes
);

app.use(
  "/api/admin-notifications",
  adminNotificationRoutes
);

app.use(
  "/api/assessments",
  assessmentRoutes
);

app.use(
  "/api/attendance",
  attendanceRoutes
);

app.use(
  "/api/upload",
  uploadRoutes
);

app.use(
  "/api/academic-structure",
  academicStructureRoutes
);

app.use(
  "/api/activity-logs",
  activityLogRoutes
);

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.json({
      success:
        true,

      message:
        "LMS Admin Panel Backend is running",
    });
  }
);

// ======================================================
// START SERVER
// ======================================================

const PORT =
  process.env.PORT ||
  5000;

// Local pe chalane ke liye; Vercel pe listen nahi karna
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
);