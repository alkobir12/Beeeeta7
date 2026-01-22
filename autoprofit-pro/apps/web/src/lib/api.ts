import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WORKSHOP_ID = process.env.NEXT_PUBLIC_WORKSHOP_ID || '00000000-0000-0000-0000-000000000001';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add workshop ID header to all requests
api.interceptors.request.use((config) => {
  config.headers['X-Workshop-ID'] = WORKSHOP_ID;
  
  // Add user ID if available (from localStorage or auth context)
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
  if (userId) {
    config.headers['X-User-ID'] = userId;
  } else {
    // Default user ID for testing
    config.headers['X-User-ID'] = '00000000-0000-0000-0000-000000000001';
  }
  
  // Add auth token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== Accounting Reports API ====================

export interface NamedAmount {
  name: string;
  amount: number;
}

export interface BalanceSheetData {
  assets: {
    current_assets: NamedAmount[];
    fixed_assets: NamedAmount[];
    total: number;
  };
  liabilities: {
    current_liabilities: NamedAmount[];
    long_term_liabilities: NamedAmount[];
    total: number;
  };
  equity: {
    capital: NamedAmount[];
    retained_earnings: NamedAmount[];
    net_income: number;
    total: number;
  };
}

export interface IncomeStatementData {
  revenues: NamedAmount[];
  cost_of_goods_sold: NamedAmount[];
  gross_profit: number;
  operating_expenses: NamedAmount[];
  operating_income: number;
  other_income: NamedAmount[];
  other_expenses: NamedAmount[];
  net_income_before_tax: number;
  tax_expense: number;
  net_income: number;
}

export interface CashFlowData {
  operating_activities: NamedAmount[];
  investing_activities: NamedAmount[];
  financing_activities: NamedAmount[];
  net_change_in_cash: number;
  opening_cash: number;
  closing_cash: number;
}

export interface TrialBalanceAccount {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceData {
  accounts: TrialBalanceAccount[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export const accountingApi = {
  // Balance Sheet
  getBalanceSheet: async (asOfDate?: string): Promise<BalanceSheetData> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    if (asOfDate) params.append('as_of_date', asOfDate);
    
    const response = await api.get(`/api/v1/accounting/reports/balance-sheet?${params}`);
    return response.data.data;
  },

  // Income Statement
  getIncomeStatement: async (startDate: string, endDate: string): Promise<IncomeStatementData> => {
    const params = new URLSearchParams({
      workshop_id: WORKSHOP_ID,
      start_date: startDate,
      end_date: endDate,
    });
    
    const response = await api.get(`/api/v1/accounting/reports/income-statement?${params}`);
    return response.data.data;
  },

  // Cash Flow Statement
  getCashFlow: async (startDate: string, endDate: string): Promise<CashFlowData> => {
    const params = new URLSearchParams({
      workshop_id: WORKSHOP_ID,
      start_date: startDate,
      end_date: endDate,
    });
    
    const response = await api.get(`/api/v1/accounting/reports/cash-flow?${params}`);
    return response.data.data;
  },

  // Trial Balance
  getTrialBalance: async (asOfDate?: string): Promise<TrialBalanceData> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    if (asOfDate) params.append('as_of_date', asOfDate);
    
    const response = await api.get(`/api/v1/accounting/reports/trial-balance?${params}`);
    return response.data.data;
  },

  // General Ledger
  getGeneralLedger: async (accountCode?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    if (accountCode) params.append('account_code', accountCode);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await api.get(`/api/v1/accounting/reports/general-ledger?${params}`);
    return response.data.data;
  },
};

// ==================== Invoices API ====================

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  account_code?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: 'sale' | 'purchase';
  invoice_date: string;
  due_date?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue';
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes?: string;
}

export interface CreateInvoiceRequest {
  invoice_type: 'sale' | 'purchase';
  invoice_date: string;
  due_date?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  items: Omit<InvoiceItem, 'total_amount'>[];
  tax_rate?: number;
  discount_amount?: number;
  notes?: string;
}

export interface PaymentRequest {
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'check';
  payment_date?: string;
  reference_number?: string;
  notes?: string;
}

export const invoicesApi = {
  // List invoices
  getInvoices: async (filters?: {
    invoice_type?: 'sale' | 'purchase';
    status?: string;
  }): Promise<Invoice[]> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    if (filters?.invoice_type) params.append('invoice_type', filters.invoice_type);
    if (filters?.status) params.append('status', filters.status);
    
    const response = await api.get(`/api/v1/accounting/invoices?${params}`);
    return response.data;
  },

  // Create invoice
  createInvoice: async (data: CreateInvoiceRequest): Promise<{ invoice_id: string; invoice_number: string }> => {
    const response = await api.post('/api/v1/accounting/invoices', data);
    return response.data;
  },

  // Issue invoice
  issueInvoice: async (invoiceId: string): Promise<{ invoice_id: string; status: string; journal_entry_id?: string }> => {
    const response = await api.post(`/api/v1/accounting/invoices/${invoiceId}/issue`);
    return response.data;
  },

  // Record payment
  recordPayment: async (invoiceId: string, payment: PaymentRequest): Promise<{ payment_id: string; amount: number }> => {
    const response = await api.post(`/api/v1/accounting/invoices/${invoiceId}/payments`, payment);
    return response.data;
  },
};

// ==================== Chart of Accounts API ====================

export interface Account {
  id: string;
  code: string;
  name_ar: string;
  name_en?: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  category: string;
  parent_id?: string;
  balance: number;
  is_active: boolean;
}

export const chartOfAccountsApi = {
  getAccounts: async (): Promise<Account[]> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    const response = await api.get(`/api/v1/accounting/accounts?${params}`);
    return response.data;
  },

  seedAccounts: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post('/api/v1/accounting/accounts/seed', null, {
      params: { workshop_id: WORKSHOP_ID },
    });
    return response.data;
  },
};

// ==================== Journal Entries API ====================

export interface JournalEntryLine {
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  total_debit: number;
  total_credit: number;
  lines: JournalEntryLine[];
  created_at: string;
}

export interface CreateJournalEntryRequest {
  entry_date: string;
  description: string;
  lines: Omit<JournalEntryLine, 'account_name'>[];
  auto_post?: boolean;
}

export const journalEntriesApi = {
  getEntries: async (filters?: {
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<JournalEntry[]> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const response = await api.get(`/api/v1/accounting/journal-entries?${params}`);
    return response.data;
  },

  createEntry: async (data: CreateJournalEntryRequest): Promise<{ entry_id: string; entry_number: string }> => {
    const response = await api.post('/api/v1/accounting/journal-entries', data);
    return response.data;
  },

  postEntry: async (entryId: string): Promise<{ entry_id: string; status: string }> => {
    const response = await api.post(`/api/v1/accounting/journal-entries/${entryId}/post`);
    return response.data;
  },
};

// ==================== AI Assistant API ====================

export interface AIAnalysisRequest {
  report_type: 'balance_sheet' | 'income_statement' | 'cash_flow';
  report_data: unknown;
  question?: string;
}

export interface AIRecommendation {
  type: 'insight' | 'warning' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export const aiApi = {
  analyzeReport: async (request: AIAnalysisRequest): Promise<{ analysis: string; recommendations: AIRecommendation[] }> => {
    const response = await api.post('/api/v1/ai/analyze', request);
    return response.data;
  },

  getFinancialInsights: async (): Promise<AIRecommendation[]> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    const response = await api.get(`/api/v1/ai/insights?${params}`);
    return response.data;
  },
};

// ==================== Dashboard API ====================

export interface DashboardStats {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  total_customers: number;
  pending_invoices: number;
  pending_amount: number;
  inventory_value: number;
  appointments_today: number;
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const params = new URLSearchParams({ workshop_id: WORKSHOP_ID });
    const response = await api.get(`/api/v1/dashboard/stats?${params}`);
    return response.data;
  },
};

export default api;
