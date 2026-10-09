import {

  useCallback,

  useEffect,

  useMemo,

  useState,

} from "react";



import {

  useNavigate,

} from "react-router-dom";



import {

  CheckSquare,

  Download,

  Eye,

  FileSpreadsheet,

  History,

  KeyRound,

  Mail,

  Pencil,

  Plus,

  Search,

  Square,

  Trash2,

  UploadCloud,

  UserRoundCheck,

  UserRoundX,

  Users,

  X,

} from "lucide-react";



import {

  getAllTeachers,

  deleteTeacher,

  updateTeacher,

} from "../services/teacherService";



import {

  AddTeacherModal,

} from "../components/DashboardModals";



import {

  EditTeacherModal,

  ResetTeacherPasswordModal,

} from "../components/TeacherModals";



import {

  EmptyState,

  TableSkeleton,

} from "../components/PageHeader";



import ConfirmDialog from "../components/ConfirmDialog";

import SelectionActionBar from "../components/SelectionActionBar";

import TeacherImportModal from "../components/TeacherImportModal";



import {

  exportRowsToCsv,

  exportRowsToExcel,

} from "../utils/exportData";



const fieldClass =

  "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white";


const PAGE_SIZE = 8;




const departmentName = (

  teacher

) =>

  teacher

    ?.linked_department

    ?.name ||

  teacher?.department ||

  "—";



const assignedCourses = (

  teacher

) =>

  Number(

    teacher

      ?.assigned_courses_count ??

      teacher?.course_count ??

      teacher

        ?.assigned_courses ??

      0

  );



const studentsCount = (

  teacher

) =>

  Number(

    teacher

      ?.students_count ??

      teacher

        ?.enrolled_students_count ??

      teacher

        ?.student_count ??

      0

  );



// ======================================================

// TEACHER VIEW MODAL

// ======================================================



function TeacherViewModal({

  teacher,

  onClose,

}) {

  if (!teacher) {

    return null;

  }



  const details = [

    [

      "Login Username",

      teacher.cnic ||

        "CNIC not set",

    ],



    [

      "Email",

      teacher.email ||

        "—",

    ],



    [

      "Faculty Department",

      departmentName(

        teacher

      ),

    ],



    [

      "Phone",

      teacher.phone ||

        "—",

    ],



    [

      "Assigned Courses",

      assignedCourses(

        teacher

      ),

    ],



    [

      "Students",

      studentsCount(

        teacher

      ),

    ],



    [

      "Status",

      teacher.is_active ===

      false

        ? "Inactive"

        : "Active",

    ],



    [

      "Last Login",

      teacher.last_login_at

        ? new Date(

            teacher.last_login_at

          ).toLocaleString()

        : "Never",

    ],

  ];



  return (

    <div

      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4"

      onMouseDown={

        onClose

      }

    >

      <div

        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"

        onMouseDown={(

          event

        ) =>

          event.stopPropagation()

        }

      >

        <div className="flex items-start justify-between gap-4">

          <div className="flex min-w-0 items-center gap-3">

            {teacher.avatar_url ? (

              <img

                src={

                  teacher.avatar_url

                }

                alt=""

                className="h-14 w-14 shrink-0 rounded-full object-cover"

              />

            ) : (

              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">

                {teacher

                  .full_name?.[0]

                  ?.toUpperCase() ||

                  "T"}

              </span>

            )}



            <div className="min-w-0">

              <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">

                {

                  teacher.full_name

                }

              </h2>



              <p className="truncate text-sm text-slate-500">

                Username:{" "}

                {teacher.cnic ||

                  "CNIC not set"}

              </p>



              {teacher.email ? (

                <p className="truncate text-xs text-slate-400">

                  {

                    teacher.email

                  }

                </p>

              ) : null}

            </div>

          </div>



          <button

            type="button"

            onClick={

              onClose

            }

            aria-label="Close teacher details"

            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"

          >

            <X

              size={18}

            />

          </button>

        </div>



        <div className="mt-6 grid gap-3 sm:grid-cols-2">

          {details.map(

            ([

              label,

              value,

            ]) => (

              <div

                key={

                  label

                }

                className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"

              >

                <p className="text-[11px] uppercase tracking-wide text-slate-400">

                  {label}

                </p>



                <p className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-200">

                  {value}

                </p>

              </div>

            )

          )}

        </div>

      </div>

    </div>

  );

}



// ======================================================

// TEACHERS PAGE

// ======================================================



export default function Teachers() {

  const navigate =

    useNavigate();



  const [

    teachers,

    setTeachers,

  ] = useState([]);



  const [

    loading,

    setLoading,

  ] = useState(true);



  const [

    error,

    setError,

  ] = useState("");



  const [

    search,

    setSearch,

  ] = useState("");



  const [

    departmentFilter,

    setDepartmentFilter,

  ] = useState("");



  const [

    statusFilter,

    setStatusFilter,

  ] = useState("");



  const [

    showAdd,

    setShowAdd,

  ] = useState(false);



  const [

    showImport,

    setShowImport,

  ] = useState(false);



  const [

    editTarget,

    setEditTarget,

  ] = useState(null);



  const [

    passwordTarget,

    setPasswordTarget,

  ] = useState(null);



  const [

    viewTarget,

    setViewTarget,

  ] = useState(null);



  const [

    statusTarget,

    setStatusTarget,

  ] = useState(null);



  const [

    deleteTarget,

    setDeleteTarget,

  ] = useState(null);



  const [

    bulkTarget,

    setBulkTarget,

  ] = useState(null);



  const [

    busy,

    setBusy,

  ] = useState(false);



  const [

    selectedIds,

    setSelectedIds,

  ] = useState([]);



  const [

    page,

    setPage,

  ] = useState(1);



  // ====================================================

  // LOAD TEACHERS

  // ====================================================



  const load =

    useCallback(

      async () => {

        setLoading(

          true

        );



        setError("");



        try {

          const response =

            await getAllTeachers();



          setTeachers(

            Array.isArray(

              response.data

            )

              ? response.data

              : []

          );

        } catch (

          err

        ) {

          setError(

            err?.response

              ?.data

              ?.message ||

              err?.message ||

              "Failed to load teachers."

          );

        } finally {

          setLoading(

            false

          );

        }

      },

      []

    );



  useEffect(

    () => {

      load();

    },

    [

      load,

    ]

  );



  // ====================================================

  // FILTERS

  // ====================================================



  const departments =

    useMemo(

      () =>

        [

          ...new Set(

            teachers

              .map(

                departmentName

              )

              .filter(

                (

                  value

                ) =>

                  value &&

                  value !==

                    "—"

              )

          ),

        ].sort(),

      [

        teachers,

      ]

    );



  const filtered =

    useMemo(

      () => {

        const query =

          search

            .trim()

            .toLowerCase();



        return teachers.filter(

          (

            teacher

          ) =>

            (

              !query ||

              `${teacher.full_name || ""} ${teacher.email || ""} ${teacher.cnic || ""} ${departmentName(

                teacher

              )}`

                .toLowerCase()

                .includes(

                  query

                )

            ) &&

            (

              !departmentFilter ||

              departmentName(

                teacher

              ) ===

                departmentFilter

            ) &&

            (

              !statusFilter ||

              (

                statusFilter ===

                "active"

                  ? teacher.is_active !==

                    false

                  : teacher.is_active ===

                    false

              )

            )

        );

      },

      [

        teachers,

        search,

        departmentFilter,

        statusFilter,

      ]

    );



  useEffect(() => {

    setPage(1);

  }, [

    search,

    departmentFilter,

    statusFilter,

  ]);



  // ====================================================

  // PAGINATION

  // ====================================================



  const totalPages =

    Math.max(

      1,

      Math.ceil(

        filtered.length /

          PAGE_SIZE

      )

    );



  useEffect(() => {

    if (

      page >

      totalPages

    ) {

      setPage(

        totalPages

      );

    }

  }, [

    page,

    totalPages,

  ]);



  const paginated =

    useMemo(

      () =>

        filtered.slice(

          (

            page - 1

          ) *

            PAGE_SIZE,

          page *

            PAGE_SIZE

        ),

      [

        filtered,

        page,

      ]

    );



  // ====================================================

  // SELECTION

  // ====================================================



  const visibleIds =

    paginated.map(

      (teacher) =>

        teacher.id

    );



  const selected =

    teachers.filter(

      (teacher) =>

        selectedIds.includes(

          teacher.id

        )

    );



  const single =

    selected.length ===

    1

      ? selected[0]

      : null;



  const allSelected =

    visibleIds.length >

      0 &&

    visibleIds.every(

      (id) =>

        selectedIds.includes(

          id

        )

    );



  const toggle = (

    id

  ) => {

    setSelectedIds(

      (

        current

      ) =>

        current.includes(

          id

        )

          ? current.filter(

              (

                value

              ) =>

                value !==

                id

            )

          : [

              ...current,

              id,

            ]

    );

  };



  const toggleAll =

    () => {

      setSelectedIds(

        (

          current

        ) =>

          allSelected

            ? current.filter(

                (id) =>

                  !visibleIds.includes(

                    id

                  )

              )

            : [

                ...new Set([

                  ...current,

                  ...visibleIds,

                ]),

              ]

      );

    };



  // ====================================================

  // EXPORT

  // ====================================================



  const rowsForExport = (

    rows

  ) =>

    rows.map(

      (

        teacher

      ) => ({

        Name:

          teacher.full_name ||

          "",



        Username_CNIC:

          teacher.cnic ||

          "",



        Email:

          teacher.email ||

          "",



        Phone:

          teacher.phone ||

          "",



        Faculty_Department:

          departmentName(

            teacher

          ),



        Assigned_Courses:

          assignedCourses(

            teacher

          ),



        Students:

          studentsCount(

            teacher

          ),



        Status:

          teacher.is_active ===

          false

            ? "Inactive"

            : "Active",



        Last_Login:

          teacher.last_login_at ||

          "",

      })

    );



  const doExport = (

    type,

    rows = filtered

  ) => {

    const data =

      rowsForExport(

        rows

      );



    const filename =

      `teachers-${new Date()

        .toISOString()

        .slice(

          0,

          10

        )}`;



    if (

      type ===

      "csv"

    ) {

      exportRowsToCsv(

        data,

        undefined,

        filename

      );

    } else {

      exportRowsToExcel(

        data,

        undefined,

        filename

      );

    }

  };



  // ====================================================

  // STATUS

  // ====================================================



  const confirmStatus =

    async () => {

      if (

        !statusTarget

      ) {

        return;

      }



      setBusy(true);



      try {

        const nextStatus =

          statusTarget.is_active ===

          false;



        await updateTeacher(

          statusTarget.id,

          {

            is_active:

              nextStatus,

          }

        );



        setStatusTarget(

          null

        );



        setSelectedIds(

          []

        );



        await load();

      } catch (

        err

      ) {

        setError(

          err?.response

            ?.data

            ?.message ||

            err?.message ||

            "Failed to update teacher status."

        );

      } finally {

        setBusy(false);

      }

    };



  // ====================================================

  // DELETE

  // ====================================================



  const confirmDelete =

    async () => {

      if (

        !deleteTarget

      ) {

        return;

      }



      setBusy(true);



      try {

        await deleteTeacher(

          deleteTarget.id

        );



        setDeleteTarget(

          null

        );



        setSelectedIds(

          []

        );



        await load();

      } catch (

        err

      ) {

        setError(

          err?.response

            ?.data

            ?.message ||

            err?.message ||

            "Failed to delete teacher. Deactivate it if historical records must be preserved."

        );

      } finally {

        setBusy(false);

      }

    };



  // ====================================================

  // BULK ACTION

  // ====================================================



  const confirmBulk =

    async () => {

      if (

        !bulkTarget ||

        !selectedIds.length

      ) {

        return;

      }



      setBusy(true);



      try {

        const results =

          await Promise.allSettled(

            selectedIds.map(

              (id) =>

                bulkTarget ===

                "delete"

                  ? deleteTeacher(

                      id

                    )

                  : updateTeacher(

                      id,

                      {

                        is_active:

                          bulkTarget ===

                          "activate",

                      }

                    )

            )

          );



        const failures =

          results.filter(

            (

              result

            ) =>

              result.status ===

              "rejected"

          ).length;



        if (failures) {

          setError(

            `${failures} selected teacher action${failures === 1 ? "" : "s"} could not be completed. Historical teachers may need deactivation instead of deletion.`

          );

        }



        setBulkTarget(

          null

        );



        setSelectedIds(

          []

        );



        await load();

      } finally {

        setBusy(false);

      }

    };



  const selectionActions = [

    {

      key: "edit",

      label: "Edit",

      icon: Pencil,

      singleOnly: true,



      onClick: () =>

        setEditTarget(

          single

        ),

    },



    {

      key: "password",

      label:

        "Reset Password",

      icon: KeyRound,

      singleOnly: true,

      tone: "warning",



      onClick: () =>

        setPasswordTarget(

          single

        ),

    },



    {

      key: "activate",

      label: "Activate",

      icon:

        UserRoundCheck,

      tone: "success",



      disabled:

        selected.length >

          0 &&

        selected.every(

          (teacher) =>

            teacher.is_active !==

            false

        ),



      onClick: () =>

        selected.length ===

        1

          ? setStatusTarget({

              ...single,

              is_active:

                false,

            })

          : setBulkTarget(

              "activate"

            ),

    },



    {

      key: "deactivate",

      label:

        "Deactivate",

      icon:

        UserRoundX,

      tone: "warning",



      disabled:

        selected.length >

          0 &&

        selected.every(

          (teacher) =>

            teacher.is_active ===

            false

        ),



      onClick: () =>

        selected.length ===

        1

          ? setStatusTarget({

              ...single,

              is_active:

                true,

            })

          : setBulkTarget(

              "deactivate"

            ),

    },



    {

      key: "csv",

      label: "CSV",

      icon: Download,



      onClick: () =>

        doExport(

          "csv",

          selected

        ),

    },



    {

      key: "excel",

      label: "Excel",

      icon:

        FileSpreadsheet,



      onClick: () =>

        doExport(

          "excel",

          selected

        ),

    },



    {

      key: "delete",

      label: "Delete",

      icon: Trash2,

      tone: "danger",



      onClick: () =>

        selected.length ===

        1

          ? setDeleteTarget(

              single

            )

          : setBulkTarget(

              "delete"

            ),

    },

  ];



  return (

    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">

      <div className="mb-6 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">

        <div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">

            Teachers

          </h1>



          <p className="mt-1 text-sm text-slate-500">

            Manage teacher

            accounts and

            teaching history.

          </p>

        </div>



        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap 2xl:justify-end">

          <button

            type="button"

            onClick={() =>

              doExport(

                "csv"

              )

            }

            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:w-auto"

          >

            <Download

              size={15}

            />



            Export CSV

          </button>



          <button

            type="button"

            onClick={() =>

              doExport(

                "excel"

              )

            }

            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:w-auto"

          >

            <FileSpreadsheet

              size={15}

            />



            Export Excel

          </button>



          <button

            type="button"

            onClick={() =>

              setShowImport(

                true

              )

            }

            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 sm:w-auto"

          >

            <UploadCloud

              size={16}

            />



            Bulk Import

          </button>



          <button

            type="button"

            onClick={() =>

              setShowAdd(

                true

              )

            }

            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:w-auto"

          >

            <Plus

              size={17}

            />



            Add Teacher

          </button>

        </div>

      </div>



      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

        <div className="grid gap-3 md:grid-cols-3">

          <label className="relative">

            <Search

              size={16}

              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"

            />



            <input

              value={search}

              onChange={(

                event

              ) =>

                setSearch(

                  event.target

                    .value

                )

              }

              className={`${fieldClass} w-full pl-9`}

              placeholder="Search name, CNIC, email or department..."

            />

          </label>



          <select

            className={

              fieldClass

            }

            value={

              departmentFilter

            }

            onChange={(

              event

            ) =>

              setDepartmentFilter(

                event.target

                  .value

              )

            }

          >

            <option value="">

              All faculty

              departments

            </option>



            {departments.map(

              (

                department

              ) => (

                <option

                  key={

                    department

                  }

                  value={

                    department

                  }

                >

                  {

                    department

                  }

                </option>

              )

            )}

          </select>



          <select

            className={

              fieldClass

            }

            value={

              statusFilter

            }

            onChange={(

              event

            ) =>

              setStatusFilter(

                event.target

                  .value

              )

            }

          >

            <option value="">

              All statuses

            </option>



            <option value="active">

              Active

            </option>



            <option value="inactive">

              Inactive

            </option>

          </select>

        </div>

      </section>



      {error ? (

        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">

          {error}

        </div>

      ) : null}



      <SelectionActionBar

        count={

          selected.length

        }

        label="teachers selected"

        actions={

          selectionActions

        }

        onClear={() =>

          setSelectedIds(

            []

          )

        }

      />



      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {loading ? (

          <TableSkeleton

            columns={7}

          />

        ) : filtered.length ===

          0 ? (

          <EmptyState

            icon={

              Users

            }

            title="No teachers found"

            description="Try changing filters or add a teacher."

          />

        ) : (

          <>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[760px] table-fixed text-left text-sm">

              <thead>

                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">

                  <th className="w-11 px-3 py-4">

                    <button

                      type="button"

                      onClick={

                        toggleAll

                      }

                    >

                      {allSelected ? (

                        <CheckSquare

                          size={

                            16

                          }

                        />

                      ) : (

                        <Square

                          size={

                            16

                          }

                        />

                      )}

                    </button>

                  </th>



                  <th className="w-[30%] px-3 py-4">

                    Teacher

                  </th>



                  <th className="w-[23%] px-3 py-4">

                    Faculty

                    Department

                  </th>



                  <th className="hidden w-[14%] px-3 py-4 md:table-cell">

                    Courses

                  </th>



                  <th className="hidden w-[14%] px-3 py-4 lg:table-cell">

                    Students

                  </th>



                  <th className="w-[12%] px-3 py-4">

                    Status

                  </th>



                  <th className="w-[82px] px-2 py-4 text-right">

                    View

                  </th>

                </tr>

              </thead>



              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                {paginated.map(

                  (

                    teacher

                  ) => (

                    <tr

                      key={

                        teacher.id

                      }

                      className={`${teacher.is_active === false ? "opacity-60" : ""} hover:bg-slate-50 dark:hover:bg-slate-800/40`}

                    >

                      <td className="px-3 py-4">

                        <button

                          type="button"

                          onClick={() =>

                            toggle(

                              teacher.id

                            )

                          }

                        >

                          {selectedIds.includes(

                            teacher.id

                          ) ? (

                            <CheckSquare

                              size={

                                16

                              }

                            />

                          ) : (

                            <Square

                              size={

                                16

                              }

                            />

                          )}

                        </button>

                      </td>



                      <td className="px-3 py-4">

                        <div className="flex min-w-0 items-center gap-2.5">

                          {teacher.avatar_url ? (

                            <img

                              src={

                                teacher.avatar_url

                              }

                              alt=""

                              className="h-9 w-9 shrink-0 rounded-full object-cover"

                            />

                          ) : (

                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">

                              {teacher

                                .full_name?.[0]

                                ?.toUpperCase() ||

                                "T"}

                            </span>

                          )}



                          <div className="min-w-0">

                            <p className="truncate font-semibold text-slate-900 dark:text-white">

                              {

                                teacher.full_name

                              }

                            </p>



                            <p className="truncate text-xs text-slate-400">

                              Username:{" "}

                              {teacher.cnic ||

                                "CNIC not set"}

                            </p>



                            {teacher.email ? (

                              <p className="flex items-center gap-1 truncate text-[11px] text-slate-400">

                                <Mail

                                  size={

                                    10

                                  }

                                />



                                {

                                  teacher.email

                                }

                              </p>

                            ) : null}

                          </div>

                        </div>

                      </td>



                      <td className="truncate px-3 py-4">

                        {departmentName(

                          teacher

                        )}

                      </td>



                      <td className="hidden px-3 py-4 font-semibold md:table-cell">

                        {assignedCourses(

                          teacher

                        )}

                      </td>



                      <td className="hidden px-3 py-4 font-semibold lg:table-cell">

                        {studentsCount(

                          teacher

                        )}

                      </td>



                      <td className="px-3 py-4">

                        <span

                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${

                            teacher.is_active ===

                            false

                              ? "bg-slate-100 text-slate-500 dark:bg-slate-800"

                              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"

                          }`}

                        >

                          {teacher.is_active ===

                          false

                            ? "Inactive"

                            : "Active"}

                        </span>

                      </td>



                      <td className="px-2 py-4">

                        <div className="flex justify-end gap-1">

                          <button

                            type="button"

                            onClick={() =>

                              setViewTarget(

                                teacher

                              )

                            }

                            title="View teacher"

                            className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"

                          >

                            <Eye

                              size={

                                16

                              }

                            />

                          </button>



                          <button

                            type="button"

                            onClick={() =>

                              navigate(

                                `/teachers/${teacher.id}/history`

                              )

                            }

                            title="Teacher history"

                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"

                          >

                            <History

                              size={

                                16

                              }

                            />

                          </button>

                        </div>

                      </td>

                    </tr>

                  )

                )}

              </tbody>

            </table>

          </div>



            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-slate-500">

                Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–

                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}

              </p>



              <div className="flex items-center gap-2">

                <button

                  type="button"

                  disabled={page === 1}

                  onClick={() =>

                    setPage((current) =>

                      Math.max(1, current - 1)

                    )

                  }

                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"

                >

                  Previous

                </button>



                <span className="text-xs text-slate-500">

                  Page {page} of {totalPages}

                </span>



                <button

                  type="button"

                  disabled={page === totalPages}

                  onClick={() =>

                    setPage((current) =>

                      Math.min(totalPages, current + 1)

                    )

                  }

                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"

                >

                  Next

                </button>

              </div>

            </div>



          </>

        )}

      </section>



      <AddTeacherModal

        open={showAdd}

        onClose={() =>

          setShowAdd(

            false

          )

        }

        onCreated={

          load

        }

      />



      <TeacherImportModal

        open={

          showImport

        }

        onClose={() =>

          setShowImport(

            false

          )

        }

        onImported={

          load

        }

      />



      <EditTeacherModal

        open={Boolean(

          editTarget

        )}

        teacher={

          editTarget

        }

        onClose={() =>

          setEditTarget(

            null

          )

        }

        onUpdated={() => {

          setSelectedIds(

            []

          );



          load();

        }}

      />



      <ResetTeacherPasswordModal

        open={Boolean(

          passwordTarget

        )}

        teacher={

          passwordTarget

        }

        onClose={() =>

          setPasswordTarget(

            null

          )

        }

        onDone={

          load

        }

      />



      <TeacherViewModal

        teacher={

          viewTarget

        }

        onClose={() =>

          setViewTarget(

            null

          )

        }

      />



      <ConfirmDialog

        open={Boolean(

          statusTarget

        )}

        onClose={() =>

          setStatusTarget(

            null

          )

        }

        onConfirm={

          confirmStatus

        }

        loading={

          busy

        }

        title={

          statusTarget

            ?.is_active ===

          false

            ? "Activate Teacher"

            : "Deactivate Teacher"

        }

        message={`Are you sure you want to ${

          statusTarget?.is_active ===

          false

            ? "activate"

            : "deactivate"

        } ${

          statusTarget?.full_name ||

          "this teacher"

        }?`}

        confirmLabel="Continue"

        danger={

          statusTarget

            ?.is_active !==

          false

        }

      />



      <ConfirmDialog

        open={Boolean(

          deleteTarget

        )}

        onClose={() =>

          setDeleteTarget(

            null

          )

        }

        onConfirm={

          confirmDelete

        }

        loading={

          busy

        }

        title="Delete Teacher"

        message={`Delete ${

          deleteTarget?.full_name ||

          "this teacher"

        }? If historical records exist, deactivate the account instead.`}

        confirmLabel="Delete"

        danger

      />



      <ConfirmDialog

        open={Boolean(

          bulkTarget

        )}

        onClose={() =>

          setBulkTarget(

            null

          )

        }

        onConfirm={

          confirmBulk

        }

        loading={

          busy

        }

        title={`${

          bulkTarget ===

          "delete"

            ? "Delete"

            : bulkTarget ===

                "activate"

              ? "Activate"

              : "Deactivate"

        } Teachers`}

        message={`Apply this action to ${selectedIds.length} selected teachers?`}

        confirmLabel="Continue"

        danger={

          bulkTarget !==

          "activate"

        }

      />

    </main>

  );

}