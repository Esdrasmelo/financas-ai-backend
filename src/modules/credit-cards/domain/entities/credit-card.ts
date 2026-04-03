export interface CreditCard {
  id: string;
  name: string;
  brand: string | null;
  limitCents: number | null;
  closingDay: number;
  dueDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
