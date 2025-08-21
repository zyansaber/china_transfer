import { useState, useMemo } from 'react';
import { useBomData } from '@/hooks/useBomData';
import { SummaryCards } from '@/components/SummaryCards';
import { FilterControls } from '@/components/FilterControls';
import { BomTable } from '@/components/BomTable';
import { SortField, SortDirection, KanbanFilter, StatusFilter } from '@/types/bom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BomTransferPage() {
  const { bomItems, loading, error, updateStatus } = useBomData();
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [kanbanFilter, setKanbanFilter] = useState<KanbanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('Value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filtered and sorted data
  const filteredAndSortedBomItems = useMemo(() => {
    let filtered = bomItems;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.Component_Material.toLowerCase().includes(term) ||
          item.Description_EN.toLowerCase().includes(term)
      );
    }

    // Apply Kanban filter
    if (kanbanFilter === 'kanban') {
      filtered = filtered.filter((item) => item.Kanban_Flag.toLowerCase() === 'kanban');
    } else if (kanbanFilter === 'non-kanban') {
      filtered = filtered.filter((item) => item.Kanban_Flag.toLowerCase() !== 'kanban');
    }

    // Apply Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => (item.Transfer_Status || 'Not Start') === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'Value':
          aValue = a.Value;
          bValue = b.Value;
          break;
        case 'Standard_Price':
          aValue = a.Standard_Price;
          bValue = b.Standard_Price;
          break;
        case 'Total_Qty':
          aValue = a.Total_Qty;
          bValue = b.Total_Qty;
          break;
        case 'Latest_Component_Date':
          aValue = new Date(a.Latest_Component_Date).getTime();
          bValue = new Date(b.Latest_Component_Date).getTime();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [bomItems, searchTerm, kanbanFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleReset = () => {
    setSearchTerm('');
    setKanbanFilter('all');
    setStatusFilter('all');
    setSortField('Value');
    setSortDirection('desc');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading BoM data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">BoM Transfer Management</h1>
          <p className="mt-2 text-gray-600">
            Manage BoM transfer status and monitor progress across all components.
          </p>
        </div>

        {/* Summary Cards */}
        <SummaryCards bomItems={bomItems} />

        {/* Filter Controls */}
        <FilterControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          kanbanFilter={kanbanFilter}
          onKanbanFilterChange={setKanbanFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onReset={handleReset}
        />

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              BoM Components ({filteredAndSortedBomItems.length} items)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <BomTable
              bomItems={filteredAndSortedBomItems}
              onStatusUpdate={updateStatus}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
        </div>
      </div>
    </div>
  );
}