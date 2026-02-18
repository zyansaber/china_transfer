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

  const headerRow = `<tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>`;

  const bodyRows = items
    .map((item) => {
      const rowValues = [
        item.Component_Material,
        item.Description_EN,
        item.Kanban_Flag,
        item.Latest_Component_Date,
        item.Standard_Price,
        item.Total_Qty,
        item.Value,
        item.Transfer_Status ?? 'Not Start',
        item.Status_UpdatedAt ?? '',
      ].map((value) => `<td>${formatValue(value)}</td>`);

      return `<tr>${rowValues.join('')}</tr>`;
    })
    .join('');

  const tableHtml = `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
  const blob = new Blob([`\ufeff${tableHtml}`], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bom-transfer-${new Date().toISOString().split('T')[0]}.xls`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

  const headerRow = `<tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>`;

  const bodyRows = items
    .map((item) => {
      const rowValues = [
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
      ].map((value) => `<td>${formatValue(value)}</td>`);

      return `<tr>${rowValues.join('')}</tr>`;
    })
    .join('');

  const tableHtml = `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
  const blob = new Blob([`\ufeff${tableHtml}`], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hold-detail-${new Date().toISOString().split('T')[0]}.xls`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
