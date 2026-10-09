import * as XLSX from "xlsx";

const normalizeCell = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const normalizeExcelCell = (value) => {
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const safeName = (value) =>
  String(value || "export")
    .trim()
    .replace(/\.(csv|xls|xlsx)$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "export";

const getColumns = (rows, columns) => {
  if (Array.isArray(columns) && columns.length) return columns;
  return Object.keys(rows?.[0] || {}).map((key) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    value: key,
  }));
};

const cellValue = (row, column) =>
  typeof column.value === "function" ? column.value(row) : row?.[column.value];

export const exportRowsToCsv = (rows = [], columns, filename = "export") => {
  if (!Array.isArray(columns)) {
    filename = columns || filename;
    columns = undefined;
  }
  const resolvedColumns = getColumns(rows, columns);
  const header = resolvedColumns
    .map((column) => `"${String(column.label).replace(/"/g, '""')}"`)
    .join(",");
  const lines = rows.map((row) =>
    resolvedColumns
      .map((column) => `"${normalizeCell(cellValue(row, column)).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = `\uFEFF${[header, ...lines].join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeName(filename)}.csv`);
};

export const exportRowsToExcel = (rows = [], columns, filename = "export") => {
  if (!Array.isArray(columns)) {
    filename = columns || filename;
    columns = undefined;
  }
  const resolvedColumns = getColumns(rows, columns);
  const excelRows = rows.map((row) => {
    const output = {};
    resolvedColumns.forEach((column) => {
      output[column.label] = normalizeExcelCell(cellValue(row, column));
    });
    return output;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows, {
    header: resolvedColumns.map((column) => column.label),
  });

  worksheet["!cols"] = resolvedColumns.map((column) => {
    let maxLength = String(column.label).length;
    rows.forEach((row) => {
      maxLength = Math.max(maxLength, Math.min(normalizeCell(cellValue(row, column)).length, 45));
    });
    return { wch: Math.max(12, maxLength + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${safeName(filename)}.xlsx`);
};
