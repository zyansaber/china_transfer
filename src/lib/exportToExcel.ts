import type { BomItem } from '@/types/bom';

const EXCEL_MIME_TYPE = 'application/vnd.ms-excel';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatValue = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '';
  }

  return escapeHtml(value);
};

const triggerFileDownload = (blob: Blob, fileName: string) => {
  const nav = window.navigator as Navigator & { msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean };
  if (typeof nav.msSaveOrOpenBlob === 'function') {
    nav.msSaveOrOpenBlob(blob, fileName);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Keep the object URL alive briefly for slower browsers before cleanup.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const buildExcelTable = (headers: string[], rows: Array<Array<string | number | undefined | null>>) => {
  const headerRow = `<tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>`;

  const bodyRows = rows
    .map((row) => {
      const rowValues = row.map((value) => `<td>${formatValue(value)}</td>`);
      return `<tr>${rowValues.join('')}</tr>`;
    })
    .join('');

  return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
};

export const exportBomItemsToExcel = (items: BomItem[]) => {
  if (!items.length) {
    return;
  }

  const headers = [
    'Component Material',
    'Description (EN)',
    'Kanban Flag',
    'Latest Component Date',
    'Standard Price',
    'Total Quantity',
    'Value',
    'Transfer Status',
    'Status Updated At',
  ];

  const rows = items.map((item) => [
    item.Component_Material,
    item.Description_EN,
    item.Kanban_Flag,
    item.Latest_Component_Date,
    item.Standard_Price,
    item.Total_Qty,
    item.Value,
    item.Transfer_Status ?? 'Not Start',
    item.Status_UpdatedAt ?? '',
  ]);

  const tableHtml = buildExcelTable(headers, rows);
  const blob = new Blob([`\ufeff${tableHtml}`], { type: EXCEL_MIME_TYPE });
  triggerFileDownload(blob, `bom-transfer-${new Date().toISOString().split('T')[0]}.xls`);
};

export const exportHoldDetailsToExcel = (items: BomItem[]) => {
  if (!items.length) {
    return;
  }

  const headers = [
    'Component Material',
    'Description (EN)',
    'Kanban Flag',
    'Latest Component Date',
    'Standard Price',
    'Total Quantity',
    'Value',
    'Transfer Status',
    'Status Updated At',
    'Expected Completion',
    'Planned Start',
    'Not To Transfer Reason',
    'Brand',
  ];

  const rows = items.map((item) => [
    item.Component_Material,
    item.Description_EN,
    item.Kanban_Flag,
    item.Latest_Component_Date,
    item.Standard_Price,
    item.Total_Qty,
    item.Value,
    item.Transfer_Status ?? 'Not Start',
    item.Status_UpdatedAt ?? '',
    item.Expected_Completion ?? '',
    item.Planned_Start ?? '',
    item.NotToTransferReason ?? '',
    item.Brand ?? '',
  ]);

  const tableHtml = buildExcelTable(headers, rows);
  const blob = new Blob([`\ufeff${tableHtml}`], { type: EXCEL_MIME_TYPE });
  triggerFileDownload(blob, `hold-detail-${new Date().toISOString().split('T')[0]}.xls`);
};
