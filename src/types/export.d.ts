// Type definitions for export functionality

export interface ExportOptions {
    format: 'csv' | 'xlsx';
    filename?: string;
}

export interface ExportRow {
    orderId: string;
    tableNo: string;
    orderDate: string;
    orderTime: string;
    status: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    orderTotal: number;
    notes?: string;
    sessionDuration?: number;
}

export interface CSVExportOptions {
    fields?: string[];
    delimiter?: string;
    header?: boolean;
}

export interface ExcelExportOptions {
    sheetName?: string;
    includeHeaders?: boolean;
    autoWidth?: boolean;
}