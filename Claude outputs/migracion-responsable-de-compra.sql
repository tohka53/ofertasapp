-- =============================================================================
-- ComparAhorro (ofertasapp)
-- Responsable de compra por articulo de lista
--
-- Proyecto Supabase : ofertasgt (bvuwwdpwvfkhyowhflta)
-- Autor             : Miguel Eduardo Cabrera Girón
-- Fecha             : 2026-09-18
--
-- Agrega la columna assigned_to a list_items para marcar a que integrante de la
-- lista le toca comprar cada producto. Las politicas RLS existentes de
-- list_items ya cubren la nueva columna. Se puede ejecutar mas de una vez.
-- =============================================================================

alter table public.list_items
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists list_items_assigned_idx on public.list_items (assigned_to);
