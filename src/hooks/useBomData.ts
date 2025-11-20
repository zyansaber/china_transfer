import { useState, useEffect } from 'react';
import { ref, onValue, update, off } from 'firebase/database';
import { database, getComponentImageUrl } from '@/lib/firebase';
import { BomItem, TransferStatus, SortField, SortDirection, KanbanFilter } from '@/types/bom';

export const useBomData = () => {
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bomRef = ref(database, 'bom_summary');
    
    const unsubscribe = onValue(
      bomRef,
      async (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const items: BomItem[] = await Promise.all(
              Object.keys(data).map(async (key) => {
                const item = data[key];
                
                // Try to get image URL for this component
                const imageUrl = await getComponentImageUrl(key);
                
                return {
                  Component_Material: key,
                  Description_EN: item.Description_EN || '',
                  Kanban_Flag: item.Kanban_Flag || '',
                  Latest_Component_Date: item.Latest_Component_Date || '',
                  Standard_Price: parseFloat(item.Standard_Price) || 0,
                  Total_Qty: parseInt(item.Total_Qty) || 0,
                  Value: (parseFloat(item.Standard_Price) || 0) * (parseInt(item.Total_Qty) || 0),
                  Transfer_Status: item.Transfer_Status || 'Not Start',
                  Status_UpdatedAt: item.Status_UpdatedAt || '',
                  imageUrl: imageUrl || undefined,
                  Expected_Completion: item.Expected_Completion || '',
                  NotToTransferReason: item.NotToTransferReason || '',
                  Brand: item.Brand || '',
                };
              })
            );
            setBomItems(items);
          } else {
            setBomItems([]);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error processing data:', err);
          setError('Failed to process data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase error:', err);
        setError('Failed to fetch data from Firebase');
        setLoading(false);
      }
    );

    return () => off(bomRef, 'value', unsubscribe);
  }, []);

  const updateStatus = async (componentMaterial: string, status: TransferStatus): Promise<boolean> => {
    try {
      const updates = {
        [`bom_summary/${componentMaterial}/Transfer_Status`]: status,
        [`bom_summary/${componentMaterial}/Status_UpdatedAt`]: new Date().toISOString(),
      };
      
      await update(ref(database), updates);
      return true;
    } catch (err) {
      console.error('Error updating status:', err);
      return false;
    }
  };

  const updateExpectedCompletion = async (componentMaterial: string, dateISO: string | null): Promise<boolean> => {
    try {
      const updates = {
        [`bom_summary/${componentMaterial}/Expected_Completion`]: dateISO || null,
      };

      await update(ref(database), updates);
      return true;
    } catch (err) {
      console.error('Error updating expected completion:', err);
      return false;
    }
  };

  const updateNotToTransferDetails = async (
    componentMaterial: string,
    reason: string,
    brand: string
  ): Promise<boolean> => {
    try {
      const updates = {
        [`bom_summary/${componentMaterial}/NotToTransferReason`]: reason,
        [`bom_summary/${componentMaterial}/Brand`]: brand,
      };

      await update(ref(database), updates);
      return true;
    } catch (err) {
      console.error('Error updating not-to-transfer details:', err);
      return false;
    }
  };

  
  return {
    bomItems,
    loading,
    error,
    updateStatus,
    updateExpectedCompletion,
    updateNotToTransferDetails,
  };
};

export const useFilteredAndSortedBom = (
  bomItems: BomItem[],
  searchTerm: string,
  kanbanFilter: KanbanFilter,
  sortField: SortField,
  sortDirection: SortDirection
) => {
  return useState(() => {
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
  })[0];
};
