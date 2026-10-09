import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Network,
  Settings,
  Users,
  X,
} from "lucide-react";

import branding from "../config/branding";

import {
  useAuth,
} from "../context/AuthContext";

function Sidebar({
  mobileOpen,
  setMobileOpen,
}) {
  const navigate =
    useNavigate();

  const {
    admin,
    logout,
  } =
    useAuth();

  // ======================================================
  // MENU
  // ======================================================

  const menuItems = [
    {
      name:
        "Dashboard",

      icon:
        LayoutDashboard,

      path:
        "/dashboard",
    },

    {
      name:
        "Teachers",

      icon:
        Users,

      path:
        "/teachers",
    },

    {
      name:
        "Students",

      icon:
        GraduationCap,

      path:
        "/students",
    },

    {
      name:
        "Academic Structure",

      icon:
        Network,

      path:
        "/academic-structure",

      children: [
        {
          name:
            "Departments",

          path:
            "/academic-structure/departments",
        },

        {
          name:
            "Programs",

          path:
            "/academic-structure/programs",
        },

        {
          name:
            "Semesters",

          path:
            "/academic-structure/semesters",
        },

        {
          name:
            "Batches",

          path:
            "/academic-structure/batches",
        },
      ],
    },

    {
      name:
        "Courses",

      icon:
        BookOpen,

      path:
        "/courses",

      children: [
        {
          name:
            "Course Catalog",

          path:
            "/courses",
        },

        {
          name:
            "Course Assignments",

          path:
            "/course-assignments",
        },

        {
          name:
            "Enrollments",

          path:
            "/enrollments",
        },
      ],
    },

    {
      name:
        "Attendance",

      icon:
        ClipboardCheck,

      path:
        "/Attendance",
    },

    {
      name:
        "Promotions",

      icon:
        GraduationCap,

      path:
        "/promotions",
    },

    {
      name:
        "Exams & Assessments",

      icon:
        CalendarDays,

      path:
        "/assessments",
    },

    {
      name:
        "Assessment Reports",

      icon:
        BarChart3,

      path:
        "/assessment-reports",
    },

    {
      name:
        "Notifications",

      icon:
        Bell,

      path:
        "/notifications",
    },

    {
      name:
        "Activity History",

      icon:
        Activity,

      path:
        "/activity",
    },

    {
      name:
        "Settings",

      icon:
        Settings,

      path:
        "/settings",
    },
  ];

  // ======================================================
  // LOGOUT
  // ======================================================

  const handleLogout =
    () => {
      logout();

      navigate(
        "/login",
        {
          replace:
            true,
        }
      );
    };

  return (
    <>
      {/* MOBILE OVERLAY */}

      {mobileOpen ? (
        <div
          className="
            fixed
            inset-0
            z-40
            bg-black/50
            animate-fade-in
            lg:hidden
          "
          onClick={() =>
            setMobileOpen(
              false
            )
          }
        />
      ) : null}

      {/* SIDEBAR */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-64
          flex-col
          overflow-hidden
          border-r
          border-slate-200
          bg-white
          transition-transform
          duration-300
          dark:border-slate-800
          dark:bg-slate-950
          lg:translate-x-0

          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* LOGO */}

        <div
          className="
            flex
            h-20
            items-center
            justify-between
            border-b
            border-slate-200
            px-6
            dark:border-slate-800
          "
        >
          <div className="flex items-center gap-3">
            <img
              src={
                branding.logo
              }
              alt={
                branding.universityName
              }
              className="
                h-11
                w-11
                object-contain
              "
            />

            <div>
              <h1
                className="
                  text-lg
                  font-bold
                  tracking-tight
                  text-slate-900
                  dark:text-white
                "
              >
                {
                  branding.shortName
                }
              </h1>

              <p
                className="
                  text-[10px]
                  font-medium
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {branding.panelName.toUpperCase()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileOpen(
                false
              )
            }
            className="
              rounded-lg
              p-2
              text-slate-500
              transition
              hover:bg-slate-100
              dark:hover:bg-slate-800
              lg:hidden
            "
            aria-label="Close sidebar"
          >
            <X
              size={
                20
              }
            />
          </button>
        </div>

        {/* NAVIGATION */}

        <nav
          className="
            sidebar-nav
            flex-1
            space-y-1
            overflow-y-auto
            px-3
            py-6
          "
        >
          {menuItems.map(
            (
              item
            ) => {
              const Icon =
                item.icon;

              return (
                <div
                  key={
                    item.name
                  }
                  className="group"
                >
                  <NavLink
                    to={
                      item.path
                    }
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                    className={({
                      isActive,
                    }) => `
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      font-medium
                      transition

                      ${
                        isActive
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                      }
                    `}
                  >
                    <Icon
                      size={
                        19
                      }
                    />

                    <span>
                      {
                        item.name
                      }
                    </span>

                    {item.children ? (
                      <ChevronDown
                        size={
                          15
                        }
                        className="ml-auto"
                      />
                    ) : null}
                  </NavLink>

                  {item.children ? (
                    <div
                      className="
                        ml-8
                        mt-1
                        hidden
                        space-y-1
                        group-hover:block
                        group-focus-within:block
                      "
                    >
                      {item.children.map(
                        (
                          child
                        ) => (
                          <NavLink
                            key={
                              child.path
                            }
                            to={
                              child.path
                            }
                            onClick={() =>
                              setMobileOpen(
                                false
                              )
                            }
                            className={({
                              isActive,
                            }) => `
                              block
                              rounded-lg
                              px-4
                              py-2
                              text-xs
                              font-medium
                              transition

                              ${
                                isActive
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                              }
                            `}
                          >
                            {
                              child.name
                            }
                          </NavLink>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              );
            }
          )}
        </nav>

        {/* BOTTOM */}

        <div
          className="
            shrink-0
            space-y-3
            border-t
            border-slate-200
            p-3
            dark:border-slate-800
          "
        >
          {admin ? (
            <div
              className="
                flex
                items-center
                gap-3
                rounded-xl
                bg-slate-50
                px-3
                py-2.5
                dark:bg-slate-900
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-blue-600
                  text-sm
                  font-semibold
                  text-white
                "
              >
                {admin.full_name?.[0]?.toUpperCase() ||
                  "A"}
              </div>

              <div className="min-w-0">
                <p
                  className="
                    truncate
                    text-sm
                    font-semibold
                    text-slate-800
                    dark:text-slate-200
                  "
                >
                  {
                    admin.full_name
                  }
                </p>

                <p
                  className="
                    truncate
                    text-xs
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  {
                    admin.email
                  }
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={
              handleLogout
            }
            className="
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-4
              py-3
              text-sm
              font-medium
              text-red-500
              transition
              hover:bg-red-50
              dark:hover:bg-red-500/10
            "
          >
            <LogOut
              size={
                19
              }
            />

            <span>
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
