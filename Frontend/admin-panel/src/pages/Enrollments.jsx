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

  BookOpen,

  CheckCircle2,

  CheckSquare,

  Eye,

  Mail,

  Pencil,

  Square,

  Trash2,

  UserCheck,

  UserPlus,

  UserX,

} from "lucide-react";



import {

  getAllEnrollments,

  deleteEnrollment,

  updateEnrollment,

} from "../services/enrollmentService";



import {

  getAllStudents,

} from "../services/studentService";



import {

  getAllCourses,

} from "../services/courseService";



import AcademicStructureService

  from "../services/AcademicStructureService";



import {

  EmptyState,

  PageHeader,

  TableSkeleton,

} from "../components/PageHeader";



import {

  EnrollStudentsModal,

} from "../components/DashboardModals";



import SingleEnrollmentModal

  from "../components/SingleEnrollmentModal";



import EditEnrollmentModal

  from "../components/EditEnrollmentModal";



import ConfirmDialog

  from "../components/ConfirmDialog";



import SelectionActionBar

  from "../components/SelectionActionBar";





const fieldClass =

  "h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white";


const PAGE_SIZE = 8;




const sameId = (first, second) =>

  String(first || "") ===

  String(second || "");





const activeOnly = (item) =>

  item?.status !== "inactive";





const unwrap = (response) =>

  Array.isArray(response?.data)

    ? response.data

    : Array.isArray(response?.data?.data)

      ? response.data.data

      : Array.isArray(response)

        ? response

        : [];





const batchLabel = (batch) =>

  batch?.start_year && batch?.end_year

    ? `${batch.start_year}–${batch.end_year}`

    : batch?.name || "Batch";





const formatDate = (

  value

) =>

  value

    ? new Date(

        value

      ).toLocaleDateString(

        undefined,

        {

          year: "numeric",

          month: "short",

          day: "numeric",

        }

      )

    : "—";





export default function Enrollments() {



  const navigate =

    useNavigate();





  const [

    enrollments,

    setEnrollments,

  ] =

    useState([]);





  const [

    students,

    setStudents,

  ] =

    useState([]);





  const [

    courses,

    setCourses,

  ] =

    useState([]);





  const [

    academic,

    setAcademic,

  ] =

    useState({

      batches: [],

      batchPrograms: [],

      departments: [],

      programs: [],

      semesters: [],

    });





  const [

    loading,

    setLoading,

  ] =

    useState(true);





  const [

    error,

    setError,

  ] =

    useState("");





  const [

    search,

    setSearch,

  ] =

    useState("");





  const [

    batchFilter,

    setBatchFilter,

  ] =

    useState("");





  const [

    departmentFilter,

    setDepartmentFilter,

  ] =

    useState("");





  const [

    programFilter,

    setProgramFilter,

  ] =

    useState("");





  const [

    semesterFilter,

    setSemesterFilter,

  ] =

    useState("");





  const [

    courseFilter,

    setCourseFilter,

  ] =

    useState("");





  const [

    statusFilter,

    setStatusFilter,

  ] =

    useState("");





  const [

    showBulk,

    setShowBulk,

  ] =

    useState(false);





  const [

    showSingle,

    setShowSingle,

  ] =

    useState(false);





  const [

    editTarget,

    setEditTarget,

  ] =

    useState(null);





  const [

    selectedIds,

    setSelectedIds,

  ] =

    useState([]);





  const [

    confirmAction,

    setConfirmAction,

  ] =

    useState(null);





  const [

    busy,

    setBusy,

  ] =

    useState(false);



  const [

    page,

    setPage,

  ] = useState(1);





  // ====================================================

  // LOAD

  // ====================================================



  const load =

    useCallback(

      async () => {



        setLoading(true);

        setError("");





        try {



          const [

            enrollmentResponse,

            studentResponse,

            courseResponse,

            batchResponse,

            batchProgramResponse,

            departmentResponse,

            programResponse,

            semesterResponse,

          ] =

            await Promise.all([

              getAllEnrollments(),

              getAllStudents(),

              getAllCourses(),

              AcademicStructureService.getBatches(),

              AcademicStructureService.getBatchPrograms(null, "active"),

              AcademicStructureService.getDepartments(),

              AcademicStructureService.getPrograms(),

              AcademicStructureService.getSemesters(),

            ]);





          setEnrollments(

            enrollmentResponse.data ||

              []

          );





          setStudents(

            studentResponse.data ||

              []

          );





          setCourses(

            courseResponse.data ||

              []

          );





          setAcademic({

            batches:

              unwrap(batchResponse),

            batchPrograms:

              unwrap(batchProgramResponse),

            departments:

              unwrap(departmentResponse),

            programs:

              unwrap(programResponse),

            semesters:

              unwrap(semesterResponse),

          });



        } catch (err) {



          setError(

            err?.message ||

              "Failed to load enrollments."

          );



        } finally {



          setLoading(false);



        }

      },



      []

    );





  useEffect(() => {



    load();



  }, [

    load,

  ]);





  // ====================================================

  // LOOKUP MAPS

  // ====================================================



  const studentMap =

    useMemo(

      () =>

        new Map(

          students.map(

            (

              student

            ) => [

              student.id,

              student,

            ]

          )

        ),



      [

        students,

      ]

    );





  const courseMap =

    useMemo(

      () =>

        new Map(

          courses.map(

            (

              course

            ) => [

              course.id,

              course,

            ]

          )

        ),



      [

        courses,

      ]

    );





  // ====================================================

  // OPTIONAL ACADEMIC FILTERS

  //

  // Every filter is optional. Selecting an upstream

  // value only narrows the options that follow it.

  // ====================================================



  const activeBatchMappings =

    useMemo(() => {

      const mappings =

        academic.batchPrograms.filter(

          activeOnly

        );



      if (!batchFilter) {

        return mappings;

      }



      return mappings.filter(

        (mapping) =>

          sameId(

            mapping.batch_id,

            batchFilter

          )

      );

    }, [

      academic.batchPrograms,

      batchFilter,

    ]);





  const batchOptions =

    useMemo(

      () =>

        academic.batches

          .filter(activeOnly)

          .slice()

          .sort(

            (first, second) =>

              Number(second.start_year || 0) -

                Number(first.start_year || 0) ||

              Number(second.end_year || 0) -

                Number(first.end_year || 0)

          ),

      [academic.batches]

    );





  const departmentOptions =

    useMemo(() => {

      let options =

        academic.departments.filter(

          activeOnly

        );



      if (batchFilter) {

        const programIds =

          new Set(

            activeBatchMappings.map(

              (mapping) =>

                String(

                  mapping.program_id

                )

            )

          );



        const departmentIds =

          new Set(

            academic.programs

              .filter((program) =>

                programIds.has(

                  String(program.id)

                )

              )

              .map((program) =>

                String(

                  program.department_id

                )

              )

          );



        options =

          options.filter(

            (department) =>

              departmentIds.has(

                String(

                  department.id

                )

              )

          );

      }



      return options

        .slice()

        .sort((first, second) =>

          String(first.name || "")

            .localeCompare(

              String(second.name || "")

            )

        );

    }, [

      academic.departments,

      academic.programs,

      activeBatchMappings,

      batchFilter,

    ]);





  const programOptions =

    useMemo(() => {

      let options =

        academic.programs.filter(

          activeOnly

        );



      if (departmentFilter) {

        options =

          options.filter(

            (program) =>

              sameId(

                program.department_id,

                departmentFilter

              )

          );

      }



      if (batchFilter) {

        const programIds =

          new Set(

            activeBatchMappings.map(

              (mapping) =>

                String(

                  mapping.program_id

                )

            )

          );



        options =

          options.filter(

            (program) =>

              programIds.has(

                String(program.id)

              )

          );

      }



      return options

        .slice()

        .sort((first, second) =>

          String(first.name || "")

            .localeCompare(

              String(second.name || "")

            )

        );

    }, [

      academic.programs,

      activeBatchMappings,

      batchFilter,

      departmentFilter,

    ]);





  const semesterOptions =

    useMemo(() => {

      let allowedProgramIds = null;



      if (programFilter) {

        allowedProgramIds =

          new Set([

            String(programFilter),

          ]);

      } else if (departmentFilter) {

        allowedProgramIds =

          new Set(

            programOptions.map(

              (program) =>

                String(program.id)

            )

          );

      } else if (batchFilter) {

        allowedProgramIds =

          new Set(

            activeBatchMappings.map(

              (mapping) =>

                String(

                  mapping.program_id

                )

            )

          );

      }



      let options =

        academic.semesters.filter(

          activeOnly

        );



      if (allowedProgramIds) {

        options =

          options.filter(

            (semester) =>

              allowedProgramIds.has(

                String(

                  semester.program_id

                )

              )

          );

      }



      // If Batch + Program are both selected, respect the

      // configured entry semester. Current semester is NOT

      // forced here; semester filtering stays manual.

      if (

        batchFilter &&

        programFilter

      ) {

        const mapping =

          activeBatchMappings.find(

            (item) =>

              sameId(

                item.program_id,

                programFilter

              )

          );



        const entryNumber =

          Number(

            mapping?.entry_semester

              ?.semester_number ||

              academic.semesters.find(

                (semester) =>

                  sameId(

                    semester.id,

                    mapping?.entry_semester_id

                  )

              )?.semester_number ||

              0

          );



        if (entryNumber) {

          options =

            options.filter(

              (semester) =>

                Number(

                  semester.semester_number ||

                    0

                ) >= entryNumber

            );

        }

      }



      return options

        .slice()

        .sort((first, second) => {

          const firstProgram =

            academic.programs.find(

              (program) =>

                sameId(

                  program.id,

                  first.program_id

                )

            );



          const secondProgram =

            academic.programs.find(

              (program) =>

                sameId(

                  program.id,

                  second.program_id

                )

            );



          const programCompare =

            String(

              firstProgram?.name || ""

            ).localeCompare(

              String(

                secondProgram?.name || ""

              )

            );



          if (programCompare) {

            return programCompare;

          }



          return (

            Number(

              first.semester_number ||

                0

            ) -

            Number(

              second.semester_number ||

                0

            )

          );

        });

    }, [

      academic.programs,

      academic.semesters,

      activeBatchMappings,

      batchFilter,

      departmentFilter,

      programFilter,

      programOptions,

    ]);





  const courseOptions =

    useMemo(() => {

      let options =

        courses.filter(

          (course) =>

            course.status !==

            "archived"

        );



      if (departmentFilter) {

        options =

          options.filter(

            (course) =>

              sameId(

                course.department_id,

                departmentFilter

              )

          );

      }



      if (programFilter) {

        options =

          options.filter(

            (course) =>

              sameId(

                course.program_id,

                programFilter

              )

          );

      } else if (batchFilter) {

        const mappedProgramIds =

          new Set(

            activeBatchMappings.map(

              (mapping) =>

                String(

                  mapping.program_id

                )

            )

          );



        options =

          options.filter(

            (course) =>

              mappedProgramIds.has(

                String(

                  course.program_id

                )

              )

          );

      }



      // If Semester is selected, only show courses that

      // actually appear in enrollments for the selected

      // academic context.

      if (semesterFilter) {

        const matchingCourseIds =

          new Set(

            enrollments

              .filter((enrollment) => {

                const assignment =

                  enrollment.course_assignment;



                const enrollmentBatchId =

                  enrollment.batch_id ||

                  assignment?.batch_id;



                const enrollmentSemesterId =

                  enrollment.semester_id ||

                  assignment?.semester_id;



                return (

                  (!batchFilter ||

                    sameId(

                      enrollmentBatchId,

                      batchFilter

                    )) &&

                  sameId(

                    enrollmentSemesterId,

                    semesterFilter

                  )

                );

              })

              .map((enrollment) =>

                String(

                  enrollment.course_id

                )

              )

          );



        options =

          options.filter(

            (course) =>

              matchingCourseIds.has(

                String(course.id)

              )

          );

      }



      return options

        .slice()

        .sort((first, second) =>

          String(first.name || "")

            .localeCompare(

              String(second.name || "")

            )

        );

    }, [

      activeBatchMappings,

      batchFilter,

      courses,

      departmentFilter,

      enrollments,

      programFilter,

      semesterFilter,

    ]);





  const filtered =

    useMemo(() => {

      const query =

        search

          .trim()

          .toLowerCase();



      return enrollments.filter(

        (enrollment) => {

          const student =

            enrollment.student ||

            studentMap.get(

              enrollment.student_id

            );



          const course =

            enrollment.course ||

            courseMap.get(

              enrollment.course_id

            );



          const assignment =

            enrollment.course_assignment;



          const enrollmentBatchId =

            enrollment.batch_id ||

            assignment?.batch_id ||

            student?.batch_id;



          const enrollmentSemesterId =

            enrollment.semester_id ||

            assignment?.semester_id ||

            student?.semester_id;



          const departmentId =

            course?.department_id ||

            student?.department_id;



          const programId =

            course?.program_id ||

            student?.program_id;



          return (

            (!batchFilter ||

              sameId(

                enrollmentBatchId,

                batchFilter

              )) &&



            (!departmentFilter ||

              sameId(

                departmentId,

                departmentFilter

              )) &&



            (!programFilter ||

              sameId(

                programId,

                programFilter

              )) &&



            (!semesterFilter ||

              sameId(

                enrollmentSemesterId,

                semesterFilter

              )) &&



            (!courseFilter ||

              sameId(

                enrollment.course_id,

                courseFilter

              )) &&



            (!statusFilter ||

              (

                enrollment.status ||

                "active"

              ) === statusFilter) &&



            (!query ||

              `${student?.full_name || ""} ${student?.email || ""} ${student?.student_id || ""} ${student?.cnic || ""} ${course?.name || ""} ${course?.course_code || ""}`

                .toLowerCase()

                .includes(query))

          );

        }

      );

    }, [

      batchFilter,

      courseFilter,

      courseMap,

      departmentFilter,

      enrollments,

      programFilter,

      search,

      semesterFilter,

      statusFilter,

      studentMap,

    ]);





  useEffect(() => {

    setPage(1);

  }, [

    search,

    batchFilter,

    departmentFilter,

    programFilter,

    semesterFilter,

    courseFilter,

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



  const selected =

    enrollments.filter(

      (

        enrollment

      ) =>

        selectedIds.includes(

          enrollment.id

        )

    );





  const visibleIds =

    paginated.map(

      (

        enrollment

      ) =>

        enrollment.id

    );





  const allSelected =

    visibleIds.length >

      0 &&



    visibleIds.every(

      (

        id

      ) =>

        selectedIds.includes(

          id

        )

    );





  const toggle = (

    id

  ) => {



    setSelectedIds(

      (

        previous

      ) =>

        previous.includes(

          id

        )

          ? previous.filter(

              (

                value

              ) =>

                value !== id

            )



          : [

              ...previous,

              id,

            ]

    );

  };





  const toggleAll =

    () => {



      setSelectedIds(

        (

          previous

        ) =>

          allSelected



            ? previous.filter(

                (

                  id

                ) =>

                  !visibleIds.includes(

                    id

                  )

              )



            : [

                ...new Set([

                  ...previous,

                  ...visibleIds,

                ]),

              ]

      );

    };





  // ====================================================

  // STATUS ACTION

  // ====================================================



  const applyStatus =

    async (

      status

    ) => {



      setBusy(true);

      setError("");





      try {



        const results =

          await Promise.allSettled(

            selectedIds.map(

              (

                id

              ) =>

                updateEnrollment(

                  id,

                  {

                    status,

                  }

                )

            )

          );





        const failed =

          results.filter(

            (

              result

            ) =>

              result.status ===

              "rejected"

          );





        if (

          failed.length

        ) {



          const firstMessage =

            failed[0]

              ?.reason

              ?.message;





          setError(

            firstMessage ||

              `${failed.length} enrollment${failed.length === 1 ? "" : "s"} could not be updated.`

          );

        }





        setSelectedIds(

          []

        );





        setConfirmAction(

          null

        );





        await load();



      } finally {



        setBusy(false);



      }

    };





  // ====================================================

  // HARD DELETE

  // ====================================================



  const hardDelete =

    async () => {



      setBusy(true);

      setError("");





      try {



        const results =

          await Promise.allSettled(

            selectedIds.map(

              (

                id

              ) =>

                deleteEnrollment(

                  id

                )

            )

          );





        const failed =

          results.filter(

            (

              result

            ) =>

              result.status ===

              "rejected"

          );





        if (

          failed.length

        ) {



          const firstMessage =

            failed[0]

              ?.reason

              ?.message;





          setError(

            firstMessage ||

              `${failed.length} enrollment${failed.length === 1 ? "" : "s"} could not be permanently deleted.`

          );

        }





        setSelectedIds(

          []

        );





        setConfirmAction(

          null

        );





        await load();



      } finally {



        setBusy(false);



      }

    };





  // ====================================================

  // ACTION BAR

  // ====================================================



  const actions = [

    {

      key:

        "edit",



      label:

        "Edit",



      icon:

        Pencil,



      singleOnly:

        true,



      onClick: () =>

        setEditTarget(

          selected[0] ||

          null

        ),

    },





    {

      key:

        "activate",



      label:

        "Activate",



      icon:

        UserCheck,



      tone:

        "success",



      disabled:

        selected.length >

          0 &&



        selected.every(

          (

            item

          ) =>

            item.status ===

            "active"

        ),



      onClick: () =>

        setConfirmAction(

          "active"

        ),

    },





    {

      key:

        "deactivate",



      label:

        "Deactivate",



      icon:

        UserX,



      tone:

        "warning",



      disabled:

        selected.length >

          0 &&



        selected.every(

          (

            item

          ) =>

            item.status ===

            "inactive"

        ),



      onClick: () =>

        setConfirmAction(

          "inactive"

        ),

    },





    {

      key:

        "complete",



      label:

        "Complete",



      icon:

        CheckCircle2,



      disabled:

        selected.length >

          0 &&



        selected.every(

          (

            item

          ) =>

            item.status ===

            "completed"

        ),



      onClick: () =>

        setConfirmAction(

          "completed"

        ),

    },





    {

      key:

        "delete",



      label:

        "Delete",



      icon:

        Trash2,



      tone:

        "danger",



      onClick: () =>

        setConfirmAction(

          "delete"

        ),

    },

  ];





  const confirmMessage =

    confirmAction ===

    "delete"



      ? `Permanently delete ${selectedIds.length} selected enrollment${selectedIds.length === 1 ? "" : "s"}? This removes the enrollment row and cannot be undone. Use Completed/Inactive when history must be kept.`



      : confirmAction ===

        "completed"



        ? `Mark ${selectedIds.length} selected enrollment${selectedIds.length === 1 ? "" : "s"} as completed? History will remain preserved. If the linked Course Assignment has no Active enrollment left, it will also be completed.`



        : `${confirmAction === "active" ? "Activate" : "Deactivate"} ${selectedIds.length} selected enrollment${selectedIds.length === 1 ? "" : "s"}?`;





  // ====================================================

  // UI

  // ====================================================



  return (

    <main className="min-h-full bg-slate-50 p-4 text-slate-700 dark:bg-slate-950 dark:text-slate-200 md:p-8">



      <PageHeader

        title="Enrollments"



        description="Active = current access, Completed = read-only history, Inactive = reversible block, Delete = permanent removal."



        search={

          search

        }



        onSearchChange={

          setSearch

        }



        searchPlaceholder="Search student or course..."



        actionLabel="Bulk Enrollment"



        onAction={() =>

          setShowBulk(

            true

          )

        }

      />





      <div className="-mt-3 mb-5 space-y-3">



        <div className="flex flex-wrap gap-3">



          <button

            type="button"

            onClick={() =>

              setShowSingle(true)

            }

            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"

          >

            Single Enrollment

          </button>



        </div>





        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">



          <select

            aria-label="Filter by batch"

            className={fieldClass}

            value={batchFilter}

            onChange={(event) => {

              setBatchFilter(

                event.target.value

              );

              setDepartmentFilter("");

              setProgramFilter("");

              setSemesterFilter("");

              setCourseFilter("");

            }}

          >

            <option value="">

              All batches

            </option>



            {batchOptions.map(

              (batch) => (

                <option

                  key={batch.id}

                  value={batch.id}

                >

                  {batchLabel(batch)}

                </option>

              )

            )}

          </select>





          <select

            aria-label="Filter by department"

            className={fieldClass}

            value={departmentFilter}

            onChange={(event) => {

              setDepartmentFilter(

                event.target.value

              );

              setProgramFilter("");

              setSemesterFilter("");

              setCourseFilter("");

            }}

          >

            <option value="">

              All departments

            </option>



            {departmentOptions.map(

              (department) => (

                <option

                  key={department.id}

                  value={department.id}

                >

                  {department.name}

                  {department.code

                    ? ` (${department.code})`

                    : ""}

                </option>

              )

            )}

          </select>





          <select

            aria-label="Filter by program"

            className={fieldClass}

            value={programFilter}

            onChange={(event) => {

              setProgramFilter(

                event.target.value

              );

              setSemesterFilter("");

              setCourseFilter("");

            }}

          >

            <option value="">

              All programs

            </option>



            {programOptions.map(

              (program) => (

                <option

                  key={program.id}

                  value={program.id}

                >

                  {program.name}

                  {program.code

                    ? ` (${program.code})`

                    : ""}

                </option>

              )

            )}

          </select>





          <select

            aria-label="Filter by semester"

            className={fieldClass}

            value={semesterFilter}

            onChange={(event) => {

              setSemesterFilter(

                event.target.value

              );

              setCourseFilter("");

            }}

          >

            <option value="">

              All semesters

            </option>



            {semesterOptions.map(

              (semester) => {

                const program =

                  academic.programs.find(

                    (item) =>

                      sameId(

                        item.id,

                        semester.program_id

                      )

                  );



                return (

                  <option

                    key={semester.id}

                    value={semester.id}

                  >

                    {program?.name

                      ? `${program.name} · `

                      : ""}

                    {semester.name ||

                      `Semester ${semester.semester_number}`}

                  </option>

                );

              }

            )}

          </select>





          <select

            aria-label="Filter by course"

            className={fieldClass}

            value={courseFilter}

            onChange={(event) =>

              setCourseFilter(

                event.target.value

              )

            }

          >

            <option value="">

              All courses

            </option>



            {courseOptions.map(

              (course) => (

                <option

                  key={course.id}

                  value={course.id}

                >

                  {course.name}

                  {course.course_code

                    ? ` (${course.course_code})`

                    : ""}

                </option>

              )

            )}

          </select>





          <select

            aria-label="Filter by status"

            className={fieldClass}

            value={statusFilter}

            onChange={(event) =>

              setStatusFilter(

                event.target.value

              )

            }

          >

            <option value="">

              All statuses

            </option>

            <option value="active">

              Active

            </option>

            <option value="completed">

              Completed

            </option>

            <option value="inactive">

              Inactive

            </option>

            <option value="suspended">

              Suspended

            </option>

            <option value="expired">

              Expired

            </option>

          </select>



        </div>



      </div>





      {error && (



        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">

          {error}

        </div>



      )}





      <SelectionActionBar

        count={

          selected.length

        }



        label="enrollments selected"



        actions={

          actions

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

            columns={

              6

            }

          />



        ) : filtered.length ===

          0 ? (



          <EmptyState

            icon={

              UserPlus

            }



            title="No enrollments found"



            description="Try changing filters or enroll students."

          />



        ) : (



          <>



          <table className="w-full table-fixed text-left text-sm">



            <thead>



              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">



                <th className="w-11 px-3 py-4">



                  <button

                    type="button"



                    onClick={

                      toggleAll

                    }



                    aria-label="Select all visible enrollments"

                  >



                    {allSelected

                      ? (

                        <CheckSquare

                          size={

                            16

                          }

                        />

                      )

                      : (

                        <Square

                          size={

                            16

                          }

                        />

                      )}



                  </button>



                </th>





                <th className="w-[28%] px-3 py-4">

                  Student

                </th>





                <th className="w-[25%] px-3 py-4">

                  Course

                </th>





                <th className="hidden w-[18%] px-3 py-4 md:table-cell">

                  Academic

                </th>





                <th className="w-[16%] px-3 py-4">

                  Status

                </th>





                <th className="w-[60px] px-2 py-4 text-right">

                  View

                </th>



              </tr>



            </thead>





            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">



              {paginated.map(

                (

                  enrollment

                ) => {



                  const student =

                    enrollment.student ||

                    studentMap.get(

                      enrollment.student_id

                    );





                  const course =

                    enrollment.course ||

                    courseMap.get(

                      enrollment.course_id

                    );





                  const semesterName =

                    enrollment

                      .course_assignment

                      ?.semester

                      ?.name ||



                    enrollment

                      .semester

                      ?.name ||



                    "—";





                  const batchName =

                    enrollment

                      .batch

                      ?.start_year &&



                    enrollment

                      .batch

                      ?.end_year



                      ? `${enrollment.batch.start_year}–${enrollment.batch.end_year}`



                      : "—";





                  return (



                    <tr

                      key={

                        enrollment.id

                      }



                      className={`${enrollment.status !== "active" ? "opacity-70" : ""} hover:bg-slate-50 dark:hover:bg-slate-800/40`}

                    >



                      <td className="px-3 py-4">



                        <button

                          type="button"



                          onClick={() =>

                            toggle(

                              enrollment.id

                            )

                          }



                          aria-label={`Select ${student?.full_name || "enrollment"}`}

                        >



                          {selectedIds.includes(

                            enrollment.id

                          )

                            ? (

                              <CheckSquare

                                size={

                                  16

                                }

                              />

                            )

                            : (

                              <Square

                                size={

                                  16

                                }

                              />

                            )}



                        </button>



                      </td>





                      <td className="px-3 py-4">



                        <p className="truncate font-semibold text-slate-900 dark:text-white">

                          {student?.full_name ||

                            "Unknown"}

                        </p>





                        <p className="flex items-center gap-1 truncate text-xs text-slate-400">



                          <Mail

                            size={

                              11

                            }

                          />



                          {student?.email ||

                            ""}



                        </p>



                      </td>





                      <td className="px-3 py-4">



                        <p className="flex items-center gap-1 truncate font-medium">



                          <BookOpen

                            size={

                              12

                            }

                          />



                          {course?.name ||

                            "Unknown course"}



                        </p>





                        <p className="truncate text-xs text-slate-400">

                          {course?.course_code ||

                            ""}

                        </p>



                      </td>





                      <td className="hidden px-3 py-4 md:table-cell">



                        <p className="truncate">

                          {semesterName}

                        </p>





                        <p className="text-xs text-slate-400">

                          {batchName}

                        </p>



                      </td>





                      <td className="px-3 py-4">



                        <span className="capitalize font-semibold">

                          {enrollment.status ||

                            "active"}

                        </span>





                        <p className="mt-1 text-xs capitalize text-slate-400">



                          {enrollment.enrollment_type ||

                            "regular"}



                          {" · "}



                          {formatDate(

                            enrollment.enrolled_at

                          )}



                        </p>



                      </td>





                      <td className="px-2 py-4 text-right">



                        <button

                          type="button"



                          disabled={

                            !student?.id

                          }



                          onClick={() =>

                            student?.id &&

                            navigate(

                              `/students/${student.id}/history`

                            )

                          }



                          title="Student history"



                          className="rounded-lg p-2 text-blue-500 transition hover:bg-blue-50 disabled:opacity-30 dark:hover:bg-blue-500/10"

                        >



                          <Eye

                            size={

                              16

                            }

                          />



                        </button>



                      </td>



                    </tr>

                  );

                }

              )}



            </tbody>



          </table>



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





      <SingleEnrollmentModal

        open={

          showSingle

        }



        onClose={() =>

          setShowSingle(

            false

          )

        }



        onCreated={

          load

        }

      />





      <EnrollStudentsModal

        open={

          showBulk

        }



        onClose={() =>

          setShowBulk(

            false

          )

        }



        onCreated={

          load

        }

      />





      <EditEnrollmentModal

        open={

          Boolean(

            editTarget

          )

        }



        enrollment={

          editTarget

        }



        onClose={() =>

          setEditTarget(

            null

          )

        }



        onUpdated={async () => {



          setEditTarget(

            null

          );



          setSelectedIds(

            []

          );



          await load();



        }}

      />





      <ConfirmDialog

        open={

          Boolean(

            confirmAction

          )

        }



        onClose={() =>

          setConfirmAction(

            null

          )

        }



        onConfirm={() =>

          confirmAction ===

          "delete"



            ? hardDelete()



            : applyStatus(

                confirmAction

              )

        }



        loading={

          busy

        }



        title={

          confirmAction ===

          "delete"



            ? "Permanently Delete Enrollment"



            : confirmAction ===

              "completed"



              ? "Complete Enrollment"



              : confirmAction ===

                "active"



                ? "Activate Enrollment"



                : "Deactivate Enrollment"

        }



        message={

          confirmMessage

        }



        confirmLabel={

          confirmAction ===

          "delete"



            ? "Delete permanently"



            : confirmAction ===

              "completed"



              ? "Mark completed"



              : confirmAction ===

                "active"



                ? "Activate"



                : "Deactivate"

        }



        danger={

          confirmAction !==

          "active"

        }

      />



    </main>

  );

}