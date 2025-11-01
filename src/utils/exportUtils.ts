import { Parser } from '@json2csv/plainjs';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { ExportRow, CSVExportOptions, ExcelExportOptions } from '../types/export';

/**
 * Export order history data to CSV format
 * @param data Array of order history records formatted as ExportRow
 * @param options CSV export options
 * @returns CSV string
 */
export function exportToCSV(data: ExportRow[], options: CSVExportOptions = {}): string {
  try {
    // Default CSV configuration
    const defaultOptions: CSVExportOptions = {
      fields: [
        'orderId',
        'tableNo', 
        'orderDate',
        'orderTime',
        'status',
        'itemName',
        'quantity',
        'unitPrice',
        'lineTotal',
        'orderTotal',
        'notes',
        'sessionDuration'
      ],
      delimiter: ',',
      header: true,
      ...options
    };

    // Create parser with configuration
    const parserConfig: any = {
      fields: defaultOptions.fields || [
        'orderId', 'tableNo', 'orderDate', 'orderTime', 'status',
        'itemName', 'quantity', 'unitPrice', 'lineTotal', 'orderTotal',
        'notes', 'sessionDuration'
      ],
      delimiter: defaultOptions.delimiter || ',',
      header: defaultOptions.header !== false,
      // Handle special characters and escape sequences
      transforms: [
        (item: any) => {
          // Clean up any special characters in string fields
          const cleanItem = { ...item };
          if (cleanItem.itemName) {
            cleanItem.itemName = String(cleanItem.itemName).replace(/[\r\n\t]/g, ' ').trim();
          }
          if (cleanItem.notes) {
            cleanItem.notes = String(cleanItem.notes).replace(/[\r\n\t]/g, ' ').trim();
          }
          if (cleanItem.status) {
            cleanItem.status = String(cleanItem.status).replace(/_/g, ' ');
          }
          return cleanItem;
        }
      ]
    };

    const parser = new Parser(parserConfig);

    // Generate CSV
    const csv = parser.parse(data);
    return csv;

  } catch (error) {
    throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export order history data to Excel format
 * @param data Array of order history records formatted as ExportRow
 * @param options Excel export options
 * @returns Excel workbook buffer
 */
export async function exportToExcel(data: ExportRow[], options: ExcelExportOptions = {}): Promise<Buffer> {
  try {
    // Default Excel configuration
    const defaultOptions: ExcelExportOptions = {
      sheetName: 'Order History',
      includeHeaders: true,
      autoWidth: true,
      ...options
    };

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(defaultOptions.sheetName);

    // Define column headers with proper formatting
    const columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Table No', key: 'tableNo', width: 10 },
      { header: 'Order Date', key: 'orderDate', width: 12 },
      { header: 'Order Time', key: 'orderTime', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Item Name', key: 'itemName', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit Price', key: 'unitPrice', width: 12 },
      { header: 'Line Total', key: 'lineTotal', width: 12 },
      { header: 'Order Total', key: 'orderTotal', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Session Duration (min)', key: 'sessionDuration', width: 18 }
    ];

    worksheet.columns = columns;

    // Style the header row
    if (defaultOptions.includeHeaders) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;
    }

    // Add data rows with formatting
    data.forEach((row, index) => {
      const cleanRow = {
        ...row,
        // Clean up special characters
        itemName: row.itemName ? String(row.itemName).replace(/[\r\n\t]/g, ' ').trim() : '',
        notes: row.notes ? String(row.notes).replace(/[\r\n\t]/g, ' ').trim() : '',
        status: row.status ? String(row.status).replace(/_/g, ' ') : '',
        // Format numbers properly
        unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : 0,
        lineTotal: typeof row.lineTotal === 'number' ? row.lineTotal : 0,
        orderTotal: typeof row.orderTotal === 'number' ? row.orderTotal : 0,
        quantity: typeof row.quantity === 'number' ? row.quantity : 0,
        sessionDuration: typeof row.sessionDuration === 'number' ? row.sessionDuration : null
      };

      const excelRow = worksheet.addRow(cleanRow);
      
      // Alternate row colors for better readability
      if (index % 2 === 1) {
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }

      // Format currency columns
      ['unitPrice', 'lineTotal', 'orderTotal'].forEach(col => {
        const cell = excelRow.getCell(col);
        cell.numFmt = '$#,##0.00';
      });

      // Format quantity column
      const qtyCell = excelRow.getCell('quantity');
      qtyCell.numFmt = '#,##0';

      // Format session duration
      const durationCell = excelRow.getCell('sessionDuration');
      if (cleanRow.sessionDuration !== null) {
        durationCell.numFmt = '#,##0';
      }
    });

    // Auto-fit columns if requested
    if (defaultOptions.autoWidth) {
      worksheet.columns.forEach(column => {
        if (column.width && column.width < 8) {
          column.width = 8;
        }
      });
    }

    // Add summary information at the bottom
    if (data.length > 0) {
      // Add empty row for spacing
      worksheet.addRow({});
      
      // Calculate summary statistics
      const totalOrders = new Set(data.map(row => row.orderId)).size;
      const totalRevenue = data.reduce((sum, row) => sum + (row.orderTotal || 0), 0);
      const totalItems = data.reduce((sum, row) => sum + (row.quantity || 0), 0);
      
      // Add summary rows
      const summaryStartRow = worksheet.rowCount + 1;
      worksheet.addRow({ orderId: 'SUMMARY', itemName: 'Total Orders:', quantity: totalOrders });
      worksheet.addRow({ orderId: '', itemName: 'Total Items:', quantity: totalItems });
      worksheet.addRow({ orderId: '', itemName: 'Total Revenue:', orderTotal: totalRevenue });
      
      // Style summary section
      for (let i = summaryStartRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        row.font = { bold: true };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'E8F4FD' }
        };
        
        // Format the revenue cell
        if (i === worksheet.rowCount) {
          const revenueCell = row.getCell('orderTotal');
          revenueCell.numFmt = '$#,##0.00';
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);

  } catch (error) {
    throw new Error(`Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transform order history documents to export format
 * @param orderHistoryDocs Array of order history documents from MongoDB
 * @returns Array of ExportRow objects ready for export
 */
export function transformOrderHistoryToExportFormat(orderHistoryDocs: any[]): ExportRow[] {
  const exportRows: ExportRow[] = [];

  orderHistoryDocs.forEach(order => {
    // Create a row for each item in the order
    order.items.forEach((item: any) => {
      const orderDate = new Date(order.orderCreatedAt);
      
      exportRows.push({
        orderId: order.originalOrderId.toString(),
        tableNo: order.tableNo,
        orderDate: orderDate.toLocaleDateString('en-US'),
        orderTime: orderDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        status: order.status,
        itemName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        lineTotal: item.lineTotal,
        orderTotal: order.total,
        notes: item.note || '',
        sessionDuration: order.sessionDuration || undefined
      });
    });
  });

  return exportRows;
}