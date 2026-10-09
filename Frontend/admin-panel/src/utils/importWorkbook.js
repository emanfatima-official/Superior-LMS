import * as XLSX from "xlsx";

export const IMPORT_FILE_ROW_LIMIT =
  2000;

export const IMPORT_REQUEST_BATCH_SIZE =
  40;

export const IMPORT_IMAGE_BATCH_SIZE =
  20;

export const IMPORT_IMAGE_MAX_BYTES =
  3 * 1024 * 1024;

export const SUPPORTED_IMPORT_FILE_TYPES =
  ".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv,.ods,.txt";

const SUPPORTED_EXTENSIONS =
  new Set([
    "xlsx",
    "xls",
    "xlsm",
    "xlsb",
    "csv",
    "tsv",
    "ods",
    "txt",
  ]);

// ======================================================
// NORMALIZE COLUMN HEADER
// ======================================================

const normalizeHeader = (
  value
) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );

// ======================================================
// FILE EXTENSION
// ======================================================

const extensionOf = (
  filename
) =>
  String(filename || "")
    .split(".")
    .pop()
    .toLowerCase();

// ======================================================
// NORMALIZE CELL VALUE
// ======================================================

const cellValue = (
  value
) => {
  if (
    value == null
  ) {
    return "";
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString();
  }

  if (
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  return String(
    value
  ).trim();
};

// ======================================================
// WORKSHEET WIDTHS
// ======================================================

const setWidths = (
  worksheet,
  widths = []
) => {
  if (
    widths.length
  ) {
    worksheet[
      "!cols"
    ] = widths.map(
      (width) => ({
        wch: width,
      })
    );
  }
};

// ======================================================
// DOWNLOAD BLOB
// ======================================================

const downloadBlob = (
  blob,
  filename
) => {
  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
};

// ======================================================
// HEADER ALIAS RESOLVER
// ======================================================

const aliasResolver = (
  definition
) => {
  const aliases =
    new Map();

  Object.entries(
    definition.aliases ||
      {}
  ).forEach(
    ([
      canonical,
      values,
    ]) => {
      [
        canonical,
        ...(values || []),
      ].forEach(
        (value) => {
          aliases.set(
            normalizeHeader(
              value
            ),
            canonical
          );
        }
      );
    }
  );

  (
    definition.headers ||
    []
  ).forEach(
    (header) => {
      const normalized =
        normalizeHeader(
          header
        );

      if (
        !aliases.has(
          normalized
        )
      ) {
        aliases.set(
          normalized,
          header
        );
      }
    }
  );

  return (
    value
  ) =>
    aliases.get(
      normalizeHeader(
        value
      )
    ) ||
    null;
};

// ======================================================
// CREATE ARRAY CHUNKS
// ======================================================

export const chunksOf = (
  rows = [],
  size =
    IMPORT_REQUEST_BATCH_SIZE
) => {
  const chunks = [];

  for (
    let index = 0;
    index < rows.length;
    index += size
  ) {
    chunks.push(
      rows.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
};

// ======================================================
// FORMAT CNIC
// ======================================================

export const formatCnic = (
  value
) => {
  const digits =
    String(value || "")
      .replace(
        /\D/g,
        ""
      );

  return digits.length ===
    13
    ? `${digits.slice(
        0,
        5
      )}-${digits.slice(
        5,
        12
      )}-${digits.slice(
        12
      )}`
    : value || "—";
};

// ======================================================
// EXTRACT CNIC FROM IMAGE FILENAME
// ======================================================

export const imageIdentifierFromFilename =
  (
    filename
  ) => {
    const withoutExtension =
      String(
        filename ||
          ""
      ).replace(
        /\.[^.]+$/,
        ""
      );

    const compact =
      withoutExtension.replace(
        /[\s-]/g,
        ""
      );

    return /^\d{13}$/.test(
      compact
    )
      ? compact
      : null;
  };

// ======================================================
// VALID PROFILE IMAGE
// ======================================================

export const validProfileImage = (
  file
) =>
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]).has(
    String(
      file?.type ||
        ""
    ).toLowerCase()
  );

// ======================================================
// READ IMPORT FILE
// ======================================================

export const readImportFile =
  async (
    file,
    definition
  ) => {
    if (!file) {
      throw new Error(
        `Select a ${definition.singularLower} data file first.`
      );
    }

    const extension =
      extensionOf(
        file.name
      );

    if (
      !SUPPORTED_EXTENSIONS.has(
        extension
      )
    ) {
      throw new Error(
        "Supported files are XLSX, XLS, XLSM, XLSB, CSV, TSV, ODS and delimited TXT."
      );
    }

    let workbook;

    if (
      [
        "csv",
        "tsv",
        "txt",
      ].includes(
        extension
      )
    ) {
      const source =
        await file.text();

      workbook =
        XLSX.read(
          source,
          {
            type: "string",
            raw: true,

            FS:
              extension ===
              "tsv"
                ? "\t"
                : undefined,
          }
        );
    } else {
      const source =
        await file.arrayBuffer();

      workbook =
        XLSX.read(
          source,
          {
            type: "array",
            raw: true,
            cellDates:
              true,
          }
        );
    }

    const sheetName =
      workbook
        .SheetNames[0];

    if (!sheetName) {
      throw new Error(
        "The selected file does not contain a worksheet."
      );
    }

    const matrix =
      XLSX.utils.sheet_to_json(
        workbook.Sheets[
          sheetName
        ],
        {
          header: 1,
          defval: "",
          raw: true,
          blankrows:
            false,
        }
      );

    const resolveHeader =
      aliasResolver(
        definition
      );

    const minimumRecognizedHeaders =
      definition.minimumRecognizedHeaders ||
      3;

    const anchorHeaders =
      definition.headerAnchor || [
        "full_name",
        "email",
      ];

    const headerIndex =
      matrix
        .slice(
          0,
          20
        )
        .findIndex(
          (row) => {
            const recognized =
              (
                row ||
                []
              )
                .map(
                  resolveHeader
                )
                .filter(
                  Boolean
                );

            return (
              recognized.length >=
                minimumRecognizedHeaders &&
              anchorHeaders.some(
                (
                  header
                ) =>
                  recognized.includes(
                    header
                  )
              )
            );
          }
        );

    if (
      headerIndex <
      0
    ) {
      throw new Error(
        "A valid header row was not found. Download the import template and keep its column names."
      );
    }

    const headers =
      (
        matrix[
          headerIndex
        ] || []
      ).map(
        resolveHeader
      );

    const duplicateHeaders =
      headers.filter(
        (
          header,
          index
        ) =>
          header &&
          headers.indexOf(
            header
          ) !== index
      );

    if (
      duplicateHeaders.length
    ) {
      throw new Error(
        `Duplicate columns found: ${[
          ...new Set(
            duplicateHeaders
          ),
        ].join(", ")}.`
      );
    }

    const present =
      new Set(
        headers.filter(
          Boolean
        )
      );

    const missing =
      (
        definition.requiredHeaders ||
        []
      ).filter(
        (header) =>
          !present.has(
            header
          )
      );

    (
      definition.requiredAnyHeaders ||
      []
    ).forEach(
      (group) => {
        if (
          !group.some(
            (
              header
            ) =>
              present.has(
                header
              )
          )
        ) {
          missing.push(
            group.join(
              " or "
            )
          );
        }
      }
    );

    if (
      missing.length
    ) {
      throw new Error(
        `Required columns missing: ${missing.join(", ")}.`
      );
    }

    const rows =
      matrix
        .slice(
          headerIndex +
            1
        )
        .map(
          (
            cells,
            rowOffset
          ) => {
            const row = {
              row_number:
                headerIndex +
                rowOffset +
                2,
            };

            headers.forEach(
              (
                header,
                columnIndex
              ) => {
                if (
                  header
                ) {
                  row[
                    header
                  ] =
                    cellValue(
                      cells?.[
                        columnIndex
                      ]
                    );
                }
              }
            );

            return definition
              .transformRow
              ? definition.transformRow(
                  row
                )
              : row;
          }
        )
        .filter(
          (row) =>
            Object.entries(
              row
            ).some(
              ([
                key,
                value,
              ]) =>
                key !==
                  "row_number" &&
                String(
                  value ??
                    ""
                ).trim()
            )
        );

    if (
      !rows.length
    ) {
      throw new Error(
        `The selected file does not contain any ${definition.pluralLower} rows.`
      );
    }

    const maximum =
      definition.rowLimit ||
      IMPORT_FILE_ROW_LIMIT;

    if (
      rows.length >
      maximum
    ) {
      throw new Error(
        `One file can contain no more than ${maximum} rows.`
      );
    }

    return {
      file_name:
        file.name,

      sheet_name:
        sheetName,

      rows,
    };
  };

// ======================================================
// APPEND EXTRA WORKBOOK SHEET
// ======================================================

const appendSheet = (
  workbook,
  sheet
) => {
  let worksheet;

  if (
    sheet.kind ===
    "aoa"
  ) {
    worksheet =
      XLSX.utils.aoa_to_sheet(
        sheet.rows || [
          [],
        ]
      );
  } else {
    worksheet =
      XLSX.utils.json_to_sheet(
        sheet.rows
          ?.length
          ? sheet.rows
          : [{}],

        sheet.options ||
          {}
      );
  }

  setWidths(
    worksheet,
    sheet.widths
  );

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sheet.name.slice(
      0,
      31
    )
  );
};

// ======================================================
// DOWNLOAD IMPORT TEMPLATE
// ======================================================

export const downloadImportTemplate =
  (
    definition,
    templateContext = {},
    format = "xlsx"
  ) => {
    const headers =
      definition.headers ||
      [];

    if (
      format ===
      "csv"
    ) {
      const worksheet =
        XLSX.utils.aoa_to_sheet([
          headers,
        ]);

      const csv =
        XLSX.utils.sheet_to_csv(
          worksheet
        );

      downloadBlob(
        new Blob(
          [
            `\uFEFF${csv}`,
          ],
          {
            type:
              "text/csv;charset=utf-8",
          }
        ),

        `${definition.filePrefix}-import-template.csv`
      );

      return;
    }

    const workbook =
      XLSX.utils.book_new();

    const dataSheet =
      XLSX.utils.aoa_to_sheet([
        headers,
      ]);

    dataSheet[
      "!autofilter"
    ] = {
      ref:
        `A1:${XLSX.utils.encode_col(
          Math.max(
            headers.length -
              1,
            0
          )
        )}1`,
    };

    setWidths(
      dataSheet,
      definition.widths
    );

    XLSX.utils.book_append_sheet(
      workbook,
      dataSheet,
      (
        definition.sheetName ||
        definition.pluralLabel
      ).slice(
        0,
        31
      )
    );

    if (
      definition.example
    ) {
      const exampleSheet =
        XLSX.utils.json_to_sheet(
          [
            definition.example(
              templateContext
            ),
          ],
          {
            header:
              headers,
          }
        );

      setWidths(
        exampleSheet,
        definition.widths
      );

      XLSX.utils.book_append_sheet(
        workbook,
        exampleSheet,
        "Example"
      );
    }

    (
      definition.extraSheets?.(
        templateContext
      ) || []
    ).forEach(
      (sheet) =>
        appendSheet(
          workbook,
          sheet
        )
    );

    const instructions = [
      [
        "Rule",
        "Details",
      ],

      ...(
        definition.instructions?.(
          templateContext
        ) || []
      ).map(
        (row) =>
          Array.isArray(
            row
          )
            ? row
            : [
                row.title ||
                  "Rule",

                row.details ||
                  "",
              ]
      ),
    ];

    const instructionsSheet =
      XLSX.utils.aoa_to_sheet(
        instructions
      );

    setWidths(
      instructionsSheet,
      [
        24,
        100,
      ]
    );

    XLSX.utils.book_append_sheet(
      workbook,
      instructionsSheet,
      "Instructions"
    );

    XLSX.writeFile(
      workbook,
      `${definition.filePrefix}-import-template.xlsx`
    );
  };

// ======================================================
// REPORT VALUE
// ======================================================

const reportValue = (
  column,
  row
) =>
  typeof column.value ===
  "function"
    ? column.value(
        row
      )
    : row?.[
        column.key
      ] ?? "";

// ======================================================
// DOWNLOAD REPORT
// ======================================================

const downloadReport = ({
  rows,
  columns,
  sheetName,
  filename,
}) => {
  const output =
    rows.map(
      (row) =>
        Object.fromEntries(
          columns.map(
            (
              column
            ) => [
              column.label,

              reportValue(
                column,
                row
              ),
            ]
          )
        )
    );

  const worksheet =
    XLSX.utils.json_to_sheet(
      output
    );

  setWidths(
    worksheet,
    columns.map(
      (column) =>
        column.width ||
        20
    )
  );

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sheetName.slice(
      0,
      31
    )
  );

  XLSX.writeFile(
    workbook,
    filename
  );
};

// ======================================================
// DOWNLOAD ACCOUNT IMPORT REPORT
// ======================================================

export const downloadImportReport =
  (
    definition,
    results = []
  ) => {
    downloadReport({
      rows:
        results,

      columns:
        definition.resultColumns,

      sheetName:
        "Import Results",

      filename:
        `${definition.filePrefix}-import-results-${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.xlsx`,
    });
  };

// ======================================================
// DOWNLOAD PROFILE IMAGE REPORT
// ======================================================

export const downloadImageReport =
  (
    definition,
    results = []
  ) => {
    const columns =
      definition.imageResultColumns || [
        {
          label:
            "Status",

          value:
            (row) =>
              row.success
                ? "Uploaded"
                : "Failed",

          width:
            12,
        },

        {
          label:
            "File",

          key:
            "file_name",

          width:
            32,
        },

        {
          label:
            definition.imageIdentityLabel,

          key:
            "identifier",

          width:
            22,
        },

        {
          label:
            `Matched ${definition.singularLabel}`,

          key:
            "profile_name",

          width:
            28,
        },

        {
          label:
            "Message",

          key:
            "message",

          width:
            60,
        },
      ];

    downloadReport({
      rows:
        results,

      columns,

      sheetName:
        "Image Results",

      filename:
        `${definition.filePrefix}-image-results-${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.xlsx`,
    });
  };