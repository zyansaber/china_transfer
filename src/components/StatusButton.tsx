import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransferStatus } from '@/types/bom';
import { CheckCircle, Clock, XCircle, Ban } from 'lucide-react';

interface StatusButtonProps {
  currentStatus: TransferStatus;
  onStatusChange: (status: TransferStatus) => Promise<boolean>;
}

export const StatusButton = ({ currentStatus, onStatusChange }: StatusButtonProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const getStatusConfig = (status: TransferStatus) => {
    switch (status) {
      case 'Not Start':
        return {
          icon: XCircle,
          variant: 'outline' as const,
          className: 'text-gray-600 border-gray-300 hover:bg-gray-50',
        };
      case 'In Progress':
        return {
          icon: Clock,
          variant: 'outline' as const,
          className: 'text-orange-600 border-orange-300 hover:bg-orange-50',
        };
      case 'Finished':
        return {
          icon: CheckCircle,
          variant: 'default' as const,
          className: 'text-white bg-green-600 hover:bg-green-700 border-green-600',
        };
      case 'Not to Transfer':
        return {
          icon: Ban,
          variant: 'outline' as const,
          className: 'text-red-600 border-red-300 hover:bg-red-50',
        };
    }
  };

  const handleStatusClick = async (newStatus: TransferStatus) => {
    if (isUpdating || newStatus === currentStatus) return;

    setIsUpdating(true);
    const success = await onStatusChange(newStatus);
    
    if (!success) {
      // Show error message - you could use a toast here
      alert('Failed to update status. Please try again.');
    }
    
    setIsUpdating(false);
  };

  const statuses: TransferStatus[] = ['Not Start', 'In Progress', 'Finished', 'Not to Transfer'];

  return (
    <div className="flex gap-1">
      {statuses.map((status) => {
        const config = getStatusConfig(status);
        const Icon = config.icon;
        const isActive = status === currentStatus;
        
        return (
          <Button
            key={status}
            size="sm"
            variant={isActive ? config.variant : 'ghost'}
            className={`h-8 px-2 ${isActive ? config.className : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => handleStatusClick(status)}
            disabled={isUpdating}
            title={status}
          >
            <Icon className="h-3 w-3" />
          </Button>
        );
      })}
    </div>
  );
};
