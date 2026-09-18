import type { LocationSelection, SelectedOffer } from './app.models';

export type ListRole = 'admin' | 'editor';
export type FamilyRole = 'admin' | 'member';
export type InvitationContext = 'lista' | 'familia';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'revoked' | 'expired';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  lang: 'es' | 'en';
  country_code: string | null;
  state_code: string | null;
  store_ids: string[] | null;
  location: LocationSelection | null;
  created_at: string;
  updated_at: string;
}

export interface ListMemberRow {
  list_id: string;
  user_id: string;
  role: ListRole;
  added_at: string;
}

export interface ListItemRow {
  id: string;
  list_id: string;
  product_query: string;
  desired_presentation: string | null;
  quantity: number;
  purchased: boolean;
  offer: SelectedOffer | null;
  added_by: string | null;
  added_at: string;
  updated_at: string;
}

export interface ShoppingListRow {
  id: string;
  name: string;
  month: number;
  year: number;
  country_code: string;
  currency: string;
  currency_symbol: string;
  owner_id: string;
  family_id: string | null;
  created_at: string;
  updated_at: string;
  purge_at: string;
  list_items?: ListItemRow[];
  list_members?: Pick<ListMemberRow, 'user_id' | 'role'>[];
}

export interface FamilyRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  family_members?: { user_id: string; role: FamilyRole }[];
}

export interface MemberInfo {
  user_id: string;
  email: string;
  nombre: string;
  rol: string;
  es_propietario: boolean;
  desde: string;
}

export interface PendingInvitation {
  id: string;
  token: string;
  contexto: InvitationContext;
  contexto_id: string;
  contexto_nombre: string;
  rol: string;
  invitado_por: string;
  creada_en: string;
  vence_en: string;
}

export interface InvitationPreview {
  token: string;
  contexto: InvitationContext;
  contexto_nombre: string;
  rol: string;
  invitado_por: string;
  correo: string;
  estado: InvitationStatus;
  vence_en: string;
  es_para_mi: boolean;
}

export interface SentInvitation {
  id: string;
  token: string;
  email: string;
  role: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
  list_id: string | null;
  family_id: string | null;
}
