// exceljs's CJS export has no `.default` — a default import compiles (under
// this project's tsconfig: allowSyntheticDefaultImports without
// esModuleInterop) to `exceljs_1.default`, which is undefined. Namespace
// import maps directly to the real module object instead.
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
}

// One sheet within an ExcelStreamWriter workbook — thin wrapper so callers
// can hold onto a handle and addRow() per sheet without re-threading the
// workbook through every call site.
export class ExcelSheetWriter {
  constructor(private readonly sheet: ExcelJS.Worksheet) {}

  addRow(row: Record<string, string | number | null>) {
    this.sheet.addRow(row).commit();
  }

  commit() {
    this.sheet.commit();
  }
}

// Streams an .xlsx workbook straight to the HTTP response as rows come in,
// instead of building the whole file in memory first — memory use stays
// proportional to one row per sheet (plus exceljs's small internal buffer),
// not the total row count, so this scales to any export size. Supports
// multiple sheets in one workbook via addWorksheet().
export class ExcelStreamWriter {
  private readonly workbook: ExcelJS.stream.xlsx.WorkbookWriter;
  private readonly sheets: ExcelSheetWriter[] = [];

  // Not stored as a parameter property — the stream is handed straight to the
  // workbook writer below and never read back off `this`.
  constructor(res: Response) {
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });
  }

  addWorksheet(sheetName: string, columns: ExcelColumnDef[]): ExcelSheetWriter {
    const sheet = this.workbook.addWorksheet(sheetName);
    sheet.columns = columns.map(({ header, key, width }) => ({
      header,
      key,
      width: width ?? 20,
    }));
    this.styleHeaderRow(sheet, columns.length);
    const writer = new ExcelSheetWriter(sheet);
    this.sheets.push(writer);
    return writer;
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number) {
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2c5b94' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.commit();
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
  }

  async end(): Promise<void> {
    for (const sheet of this.sheets) sheet.commit();
    await this.workbook.commit();
  }
}
