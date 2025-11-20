import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RotateCcw } from 'lucide-react';
import { KanbanFilter, StatusFilter } from '@/types/bom';

interface FilterControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  kanbanFilter: KanbanFilter;
  onKanbanFilterChange: (filter: KanbanFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onReset: () => void;
}

export const FilterControls = ({
  searchTerm,
  onSearchChange,
  kanbanFilter,
  onKanbanFilterChange,
  statusFilter,
  onStatusFilterChange,
  onReset,
}: FilterControlsProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search by material number or description..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex gap-2">
        <Select value={kanbanFilter} onValueChange={onKanbanFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by Kanban" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="kanban">Kanban Only</SelectItem>
            <SelectItem value="non-kanban">Non-Kanban Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Not Start">Not Start</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Finished">Finished</SelectItem>
            <SelectItem value="Not to Transfer">Not to Transfer</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          onClick={onReset}
          className="px-3"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
