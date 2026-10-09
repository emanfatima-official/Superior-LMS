import * as XLSX from "xlsx";

// ======================================================
// HELPERS
// ======================================================

const safeName = (
  value
) =>
  String(
    value ||
      "attendance-report"
  )
    .trim()
    .replace(
      /\.(csv|xls|xlsx)$/i,
      ""
    )
    .replace(
      /[^a-z0-9-_]+/gi,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) ||
  "attendance-report";

const autoWidth = (
  rows = []
) => {
  const keys =
    Object.keys(
      rows?.[0] ||
        {}
    );

  return keys.map(
    (
      key
    ) => {
      let max =
        String(
          key
        ).length;

      rows.forEach(
        (
          row
        ) => {
          max =
            Math.max(
              max,

              Math.min(
                String(
                  row?.[
                    key
                  ] ??
                    ""
                ).length,

                35
              )
            );
        }
      );

      return {
        wch:
          Math.max(
            12,
            max +
              2
          ),
      };
    }
  );
};

const appendSheet = (
  workbook,
  rows,
  name
) => {
  if (
    !Array.isArray(
      rows
    ) ||
    !rows.length
  ) {
    return;
  }

  const worksheet =
    XLSX.utils.json_to_sheet(
      rows
    );

  worksheet[
    "!cols"
  ] =
    autoWidth(
      rows
    );

  // Freeze top row and first column where supported.
  worksheet[
    "!freeze"
  ] = {
    xSplit: 1,
    ySplit: 1,
  };

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    name
  );
};

// ======================================================
// EXCEL EXPORT
// ======================================================

export const exportAttendanceWorkbook =
  (
    data = {},
    filename =
      "attendance-report"
  ) => {
    const workbook =
      XLSX.utils.book_new();

    appendSheet(
      workbook,
      data.semester_matrix ||
        [],
      "Semester Matrix"
    );

    appendSheet(
      workbook,
      data.course_register ||
        [],
      "Date-wise Register"
    );

    appendSheet(
      workbook,
      data.course_summary ||
        [],
      "Course Summary"
    );

    appendSheet(
      workbook,
      data.session_rows ||
        [],
      "Detailed Log"
    );

    // At least one worksheet is required.
    if (
      !workbook.SheetNames
        .length
    ) {
      const worksheet =
        XLSX.utils.aoa_to_sheet([
          [
            "No attendance data available",
          ],
        ]);

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Attendance"
      );
    }

    XLSX.writeFile(
      workbook,
      `${safeName(
        filename
      )}.xlsx`
    );
  };