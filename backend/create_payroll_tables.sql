-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  position text,
  hourly_rate numeric(10,2) default 0,
  monthly_salary numeric(12,2) default 0,
  hire_date timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Salaries table  
CREATE TABLE IF NOT EXISTS salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  month int not null,
  year int not null,
  basic_salary numeric(12,2) not null,
  allowances numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  total_salary numeric(12,2) not null,
  payment_date timestamptz,
  payment_status text default 'pending',
  notes text,
  created_at timestamptz default now(),
  unique(employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salaries (employee_id);
CREATE INDEX IF NOT EXISTS idx_salaries_period ON salaries (year desc, month desc);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
