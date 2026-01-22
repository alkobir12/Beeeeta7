export interface Workshop {
  id: string;
  name: string;
  currency: string;
  tax_rate: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  created_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
  account_name: string;
}
