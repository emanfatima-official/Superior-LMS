import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import Dashboard from "./pages/Dashboard";

import Teachers from "./pages/Teachers";
import TeacherHistory from "./pages/TeacherHistory";

import Students from "./pages/Students";
import StudentHistory from "./pages/StudentHistory";
import StudentCourseHistory from "./pages/StudentCourseHistory";

import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import CourseHistory from "./pages/CourseHistory";

import CourseAssignments from "./pages/CourseAssignments";
import CourseAssignmentHistory from "./pages/CourseAssignmentHistory";

import Enrollments from "./pages/Enrollments";

import Attendance from "./pages/Attendance";

import Promotions from "./pages/Promotions";

import Assessments from "./pages/Assessments";
import AssessmentReports from "./pages/AssessmentReports";

import Notifications from "./pages/Notifications";

import Activity from "./pages/Activity";

import Settings from "./pages/Settings";

import AcademicStructure from "./pages/AcademicStructure";

import {
  AcademicBatches,
  AcademicDepartments,
  AcademicPrograms,
  AcademicSemesters,
} from "./pages/AcademicStructurePages";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import {
  useAuth,
} from "./context/AuthContext";

// ======================================================
// ROOT REDIRECT
// ======================================================

function RootRedirect() {
  const {
    isAuthenticated,
  } =
    useAuth();

  return (
    <Navigate
      to={
        isAuthenticated
          ? "/dashboard"
          : "/login"
      }
      replace
    />
  );
}

// ======================================================
// APP
// ======================================================

function App() {
  return (
    <Routes>
      {/* ROOT */}

      <Route
        path="/"
        element={
          <RootRedirect />
        }
      />

      {/* PUBLIC */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      <Route
        path="/signup"
        element={
          <Signup />
        }
      />

      {/* PROTECTED */}

      <Route
        element={
          <ProtectedRoute />
        }
      >
        <Route
          element={
            <Layout />
          }
        >
          {/* DASHBOARD */}

          <Route
            path="/dashboard"
            element={
              <Dashboard />
            }
          />

          {/* TEACHERS */}

          <Route
            path="/teachers"
            element={
              <Teachers />
            }
          />

          <Route
            path="/teachers/:id/history"
            element={
              <TeacherHistory />
            }
          />

          {/* STUDENTS */}

          <Route
            path="/students"
            element={
              <Students />
            }
          />

          <Route
            path="/students/:id/history"
            element={
              <StudentHistory />
            }
          />

          <Route
            path="/students/:id/history/:courseAssignmentId"
            element={
              <StudentCourseHistory />
            }
          />

          {/* COURSES */}

          <Route
            path="/courses"
            element={
              <Courses />
            }
          />

          <Route
            path="/courses/:id/history"
            element={
              <CourseHistory />
            }
          />

          <Route
            path="/courses/:id"
            element={
              <CourseDetail />
            }
          />

          <Route
            path="/courses/:id/:section"
            element={
              <CourseDetail />
            }
          />

          {/* COURSE ASSIGNMENTS */}

          <Route
            path="/course-assignments"
            element={
              <CourseAssignments />
            }
          />

          <Route
            path="/course-assignments/:id/history"
            element={
              <CourseAssignmentHistory />
            }
          />

          {/* ENROLLMENTS */}

          <Route
            path="/enrollments"
            element={
              <Enrollments />
            }
          />

          {/* ATTENDANCE */}

          <Route
            path="/attendance"
            element={
              <Attendance />
            }
          />

          {/* PROMOTIONS */}

          <Route
            path="/promotions"
            element={
              <Promotions />
            }
          />

          {/* EXAMS */}

          <Route
            path="/assessments"
            element={
              <Assessments />
            }
          />

          {/* ASSESSMENT REPORTS */}

          <Route
            path="/assessment-reports"
            element={
              <AssessmentReports />
            }
          />

          {/* NOTIFICATIONS */}

          <Route
            path="/notifications"
            element={
              <Notifications />
            }
          />

          {/* ACTIVITY */}

          <Route
            path="/activity"
            element={
              <Activity />
            }
          />

          {/* SETTINGS */}

          <Route
            path="/settings"
            element={
              <Settings />
            }
          />

          {/* ACADEMIC STRUCTURE */}

          <Route
            path="/academic-structure"
            element={
              <AcademicStructure />
            }
          />

          <Route
            path="/academic-structure/batches"
            element={
              <AcademicBatches />
            }
          />

          <Route
            path="/academic-structure/departments"
            element={
              <AcademicDepartments />
            }
          />

          <Route
            path="/academic-structure/programs"
            element={
              <AcademicPrograms />
            }
          />

          <Route
            path="/academic-structure/semesters"
            element={
              <AcademicSemesters />
            }
          />
        </Route>
      </Route>

      {/* UNKNOWN */}

      <Route
        path="*"
        element={
          <RootRedirect />
        }
      />
    </Routes>
  );
}

export default App;