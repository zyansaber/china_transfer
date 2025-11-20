export type TransferStatus = "Not Start" | "In Progress" | "Finished" | "Temporary Usage" | "Not to Transfer";

export interface BomItem {
  Component_Material: string;
  Description_EN: string;
  Kanban_Flag: string;
  Latest_Component_Date: string;
  Standard_Price: number;
  Total_Qty: number;
  Value: number; // Calculated field
  Transfer_Status?: TransferStatus;
  Status_UpdatedAt?: string;
  imageUrl?: string; // Added for component images
  Expected_Completion?: string;
  NotToTransferReason?: string;
  Brand?: string;
}

export interface BomSummary {
  totalBomValue: number;
  kanbanValue: number;
  partsCount: number; // Added for parts count
  statusTotals: {
    "Not Start": number;
    "In Progress": number;
    "Finished": number;
    "Temporary Usage": number;
    "Not to Transfer": number;
  };
}

export type SortField = "Value" | "Standard_Price" | "Total_Qty" | "Latest_Component_Date";
export type SortDirection = "asc" | "desc";
export type KanbanFilter = "all" | "kanban" | "non-kanban";
export type StatusFilter = "all" | TransferStatus;
