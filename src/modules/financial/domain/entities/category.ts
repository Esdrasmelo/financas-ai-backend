export type CategoryType = "expense" | "income";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}
