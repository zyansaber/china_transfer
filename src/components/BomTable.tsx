import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, ImageIcon } from 'lucide-react';
import { BomItem, SortField, SortDirection, TransferStatus } from '@/types/bom';
import { StatusButton } from './StatusButton';

interface BomTableProps {
  bomItems: BomItem[];
  onStatusUpdate: (componentMaterial: string, status: TransferStatus) => Promise<boolean>;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export const BomTable = ({
  bomItems,
  onStatusUpdate,
  sortField,
  sortDirection,
  onSort,
}: BomTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const sortableColumns = [
    { key: 'Value' as SortField, label: 'Value' },
    { key: 'Standard_Price' as SortField, label: 'Standard Price' },
    { key: 'Total_Qty' as SortField, label: 'Total Qty' },
    { key: 'Latest_Component_Date' as SortField, label: 'Latest Date' },
  ];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Component Material</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Kanban Flag</TableHead>
            {sortableColumns.map((col) => (
              <TableHead key={col.key}>
                <Button
                  variant="ghost"
                  onClick={() => onSort(col.key)}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  {col.label}
                  {getSortIcon(col.key)}
                </Button>
              </TableHead>
            ))}
            <TableHead>Transfer Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bomItems.map((item) => (
            <TableRow key={item.Component_Material}>
              <TableCell className="w-20">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.Component_Material}
                    className="w-16 h-16 object-contain rounded border bg-gray-50"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-16 h-16 flex items-center justify-center bg-gray-100 rounded border text-gray-400">
                            <span class="text-xs">Unavailable</span>
                          </div>
                        `;
                      }
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded border text-gray-400">
                    <span className="text-xs">Unavailable</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">
                {item.Component_Material}
              </TableCell>
              <TableCell>{item.Description_EN}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.Kanban_Flag.toLowerCase() === 'kanban'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {item.Kanban_Flag}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.Value)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.Standard_Price)}
              </TableCell>
              <TableCell className="text-right">
                {item.Total_Qty.toLocaleString()}
              </TableCell>
              <TableCell>{formatDate(item.Latest_Component_Date)}</TableCell>
              <TableCell>
                <StatusButton
                  currentStatus={item.Transfer_Status || 'Not Start'}
                  onStatusChange={(status) => onStatusUpdate(item.Component_Material, status)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {bomItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No items found matching your criteria.
        </div>
      )}
    </div>
  );
};