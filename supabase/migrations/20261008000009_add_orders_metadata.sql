-- Add metadata column to public.orders for storing audit metadata like admin notes
alter table public.orders add column if not exists metadata jsonb not null default '{}'::jsonb;
