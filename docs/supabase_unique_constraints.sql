-- Add unique constraints needed for fast Excel imports (UPSERT)
-- Run this in Supabase: SQL Editor

-- 1) Parts: unique part_number
alter table if exists public.parts
  add constraint if not exists parts_part_number_unique unique (part_number);

-- 2) Services: unique name
alter table if exists public.services
  add constraint if not exists services_name_unique unique (name);
