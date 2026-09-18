import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { I18nService } from '../i18n/i18n.service';
import { translate } from '../i18n/translate';
import { monthName } from '../logic/format';
import { isValidQuantity } from '../logic/list-math';
import { neutralPresentation } from '../logic/presentation';
import { applyRefreshChanges, type RefreshChange } from '../logic/refresh-diff';
import type { Country, CurrencyCode, Lang, Offer } from '../models/api.models';
import { manualOffer, toSelectedOffer, type ListItem, type ManualPriceInput, type SelectedOffer, type ShoppingList } from '../models/app.models';
import type { ListItemRow, ShoppingListRow } from '../models/db.models';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { NotifyService } from './notify.service';
import { PreferencesService } from './preferences.service';
import { SessionEventsService } from './session-events.service';

const LIST_COLUMNS =
  'id, name, month, year, country_code, currency, currency_symbol, owner_id, family_id, created_at, updated_at, purge_at, list_items(*), list_members(user_id, role)';

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Misma regla que la columna generada purge_at: primer dia del mes + cuatro meses. */
export function fechaDePurga(year: number, month: number): string {
  return new Date(Date.UTC(year, month + 3, 1)).toISOString().slice(0, 10);
}

export function defaultListName(month: number, lang: Lang = 'es'): string {
  const name = monthName(month, lang);
  return translate(lang, 'lists.defaultName', { month: lang === 'en' ? name.charAt(0).toUpperCase() + name.slice(1) : name }).trim();
}

export interface NewListInput {
  name: string;
  month: number;
  year: number;
  familyId?: string | null;
}

/**
 * Listas de compras guardadas en Supabase y compartidas entre los miembros de
 * la lista o del grupo familiar. El estado local es la copia de trabajo: cada
 * cambio se aplica de inmediato y se envia a la base de datos.
 */
@Injectable({ providedIn: 'root' })
export class ListsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  private readonly i18n = inject(I18nService);
  private readonly notify = inject(NotifyService);
  private readonly listsState = signal<ShoppingList[]>([]);
  private readonly loadingState = signal(false);
  private channel: RealtimeChannel | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastReloadAt = 0;
  private inFlight = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  readonly lists = this.listsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  readonly listsForCurrentCountry = computed(() => {
    const code = this.preferences.countryCode();
    return this.listsState().filter((l) => l.countryCode === code);
  });
  readonly otherCountriesListCount = computed(() => {
    const code = this.preferences.countryCode();
    return this.listsState().filter((l) => l.countryCode !== code).length;
  });
  readonly sharedListCount = computed(() => this.listsState().filter((l) => l.memberCount > 1).length);

  constructor() {
    inject(SessionEventsService)
      .reset$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.listsState.set([]);
        this.unsubscribe();
      });

    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (!userId) return;
        void this.reload();
        this.subscribe(userId);
      });
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refreshIfStale();
      });
      window.addEventListener('focus', () => this.refreshIfStale());
    }
  }

  /** Vuelve a leer las listas si pasaron mas de 20 s desde la ultima lectura. */
  refreshIfStale(): void {
    if (!this.auth.userId() || this.inFlight > 0) return;
    if (Date.now() - this.lastReloadAt < 20_000) return;
    void this.reload();
  }

  get(listId: string): ShoppingList | undefined {
    return this.listsState().find((l) => l.id === listId);
  }

  async reload(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    this.loadingState.set(true);
    const { data, error } = await this.supabase.client
      .from('shopping_lists')
      .select(LIST_COLUMNS)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('created_at', { ascending: false });
    this.loadingState.set(false);
    if (error) {
      this.notify.error(this.i18n.t('data.loadError'));
      return;
    }
    this.lastReloadAt = Date.now();
    this.listsState.set((data as ShoppingListRow[]).map((row) => this.toList(row, userId)));
  }

  create(input: NewListInput, country: Country): ShoppingList {
    const userId = this.auth.userId();
    const now = new Date().toISOString();
    const list: ShoppingList = {
      id: newId(),
      name: input.name.trim() || defaultListName(input.month, this.i18n.lang()),
      month: input.month,
      year: input.year,
      countryCode: country.code,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      createdAt: now,
      updatedAt: now,
      ownerId: userId ?? '',
      familyId: input.familyId ?? null,
      role: 'admin',
      memberCount: 1,
      purgeAt: fechaDePurga(input.year, input.month),
      items: [],
    };
    this.listsState.update((lists) => [list, ...lists]);
    void this.run(async () => {
      const { error } = await this.supabase.client.from('shopping_lists').insert({
        id: list.id,
        name: list.name,
        month: list.month,
        year: list.year,
        country_code: list.countryCode,
        currency: list.currency,
        currency_symbol: list.currencySymbol,
        owner_id: userId,
        family_id: list.familyId,
      });
      if (error) throw error;
    });
    return list;
  }

  update(listId: string, changes: Partial<Pick<ShoppingList, 'name' | 'month' | 'year' | 'familyId'>>): void {
    this.patch(listId, (list) => {
      const next = { ...list, ...changes, name: (changes.name ?? list.name).trim() || list.name };
      return { ...next, purgeAt: fechaDePurga(next.year, next.month) };
    });
    const list = this.get(listId);
    if (!list) return;
    void this.run(async () => {
      const { error } = await this.supabase.client
        .from('shopping_lists')
        .update({ name: list.name, month: list.month, year: list.year, family_id: list.familyId })
        .eq('id', listId);
      if (error) throw error;
    });
  }

  remove(listId: string): void {
    this.listsState.update((lists) => lists.filter((l) => l.id !== listId));
    void this.run(async () => {
      const { error } = await this.supabase.client.from('shopping_lists').delete().eq('id', listId);
      if (error) throw error;
    });
  }

  /** Salir de una lista compartida sin borrarla para los demas. */
  leave(listId: string): void {
    const userId = this.auth.userId();
    if (!userId) return;
    this.listsState.update((lists) => lists.filter((l) => l.id !== listId));
    void this.run(async () => {
      const { error } = await this.supabase.client.from('list_members').delete().eq('list_id', listId).eq('user_id', userId);
      if (error) throw error;
    });
  }

  addManualItem(listId: string, input: { productQuery: string; desiredPresentation: string | null; quantity: number }): ListItem {
    const item: ListItem = {
      id: newId(),
      productQuery: input.productQuery.trim(),
      desiredPresentation: input.desiredPresentation?.trim() || null,
      quantity: this.safeQuantity(input.quantity),
      purchased: false,
      offer: null,
      addedAt: new Date().toISOString(),
      addedBy: this.auth.userId(),
    };
    this.patch(listId, (list) => ({ ...list, items: [...list.items, item] }));
    this.insertItem(listId, item);
    return item;
  }

  /** Anade una oferta. Si la misma oferta ya esta en la lista, suma la cantidad. */
  addOffer(listId: string, offer: Offer, quantity: number): { merged: boolean } {
    const list = this.get(listId);
    if (!list) throw new Error('List not found');
    if (list.countryCode !== offer.countryCode) throw new Error('The offer belongs to another country and currency');
    const existing = list.items.find((i) => i.offer?.offerId === offer.id);
    if (existing) {
      this.setQuantity(listId, existing.id, existing.quantity + this.safeQuantity(quantity));
      return { merged: true };
    }
    const item: ListItem = {
      id: newId(),
      productQuery: offer.name,
      desiredPresentation: neutralPresentation(offer.content, offer.presentation),
      quantity: this.safeQuantity(quantity),
      purchased: false,
      offer: toSelectedOffer(offer),
      addedAt: new Date().toISOString(),
      addedBy: this.auth.userId(),
    };
    this.patch(listId, (l) => ({ ...l, items: [...l.items, item] }));
    this.insertItem(listId, item);
    return { merged: false };
  }

  addManualPrice(listId: string, input: ManualPriceInput, quantity: number): ListItem {
    const list = this.get(listId);
    if (!list) throw new Error('List not found');
    const item: ListItem = {
      id: newId(),
      productQuery: input.productName,
      desiredPresentation: input.presentation,
      quantity: this.safeQuantity(quantity),
      purchased: false,
      offer: manualOffer(input, list.currency, newId()),
      addedAt: new Date().toISOString(),
      addedBy: this.auth.userId(),
    };
    this.patch(listId, (l) => ({ ...l, items: [...l.items, item] }));
    this.insertItem(listId, item);
    return item;
  }

  setManualPrice(listId: string, itemId: string, input: ManualPriceInput): void {
    const list = this.get(listId);
    if (!list) throw new Error('List not found');
    const offer = manualOffer(input, list.currency, newId());
    this.patchItem(listId, itemId, (item) => ({ ...item, offer }));
    this.updateItem(itemId, { offer });
  }

  setOffer(listId: string, itemId: string, offer: Offer | SelectedOffer | null): void {
    const selected = offer === null ? null : 'offerId' in offer ? offer : toSelectedOffer(offer);
    this.patchItem(listId, itemId, (item) => ({ ...item, offer: selected }));
    this.updateItem(itemId, { offer: selected });
  }

  setQuantity(listId: string, itemId: string, quantity: number): void {
    if (!isValidQuantity(quantity)) return;
    this.patchItem(listId, itemId, (item) => ({ ...item, quantity }));
    this.updateItem(itemId, { quantity });
  }

  togglePurchased(listId: string, itemId: string, purchased: boolean): void {
    this.patchItem(listId, itemId, (item) => ({ ...item, purchased }));
    this.updateItem(itemId, { purchased });
  }

  removeItem(listId: string, itemId: string): void {
    this.patch(listId, (list) => ({ ...list, items: list.items.filter((i) => i.id !== itemId) }));
    void this.run(async () => {
      const { error } = await this.supabase.client.from('list_items').delete().eq('id', itemId);
      if (error) throw error;
    });
  }

  applyRefresh(listId: string, confirmed: RefreshChange[]): void {
    this.patch(listId, (list) => applyRefreshChanges(list, confirmed));
    const list = this.get(listId);
    if (!list) return;
    const touched = new Set(confirmed.map((c) => c.itemId));
    for (const item of list.items) {
      if (touched.has(item.id)) this.updateItem(item.id, { offer: item.offer });
    }
  }

  private insertItem(listId: string, item: ListItem): void {
    void this.run(async () => {
      const { error } = await this.supabase.client.from('list_items').insert({
        id: item.id,
        list_id: listId,
        product_query: item.productQuery,
        desired_presentation: item.desiredPresentation,
        quantity: item.quantity,
        purchased: item.purchased,
        offer: item.offer,
        added_by: item.addedBy,
      });
      if (error) throw error;
    });
  }

  private updateItem(itemId: string, patch: Partial<{ quantity: number; purchased: boolean; offer: SelectedOffer | null }>): void {
    void this.run(async () => {
      const { error } = await this.supabase.client.from('list_items').update(patch).eq('id', itemId);
      if (error) throw error;
    });
  }

  /**
   * Las escrituras se encadenan: la lista tiene que existir en la base antes de
   * que llegue el primer articulo, y dos peticiones sueltas no garantizan orden.
   */
  private run(action: () => Promise<void>): Promise<void> {
    this.inFlight += 1;
    const next = this.writeQueue.then(async () => {
      try {
        await action();
      } catch {
        this.notify.error(this.i18n.t('data.saveError'));
        await this.reload();
      } finally {
        this.inFlight -= 1;
      }
    });
    this.writeQueue = next;
    return next;
  }

  private subscribe(userId: string): void {
    this.unsubscribe();
    this.channel = this.supabase.client
      .channel(`listas-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, () => this.scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => this.scheduleReload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_members' }, () => this.scheduleReload())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') this.stopPolling();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.startPolling();
      });
  }

  /** Respaldo cuando el canal en vivo no conecta: relee cada minuto. */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.refreshIfStale(), 60_000);
  }

  private stopPolling(): void {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private unsubscribe(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = null;
    this.stopPolling();
    if (!this.channel) return;
    void this.supabase.client.removeChannel(this.channel);
    this.channel = null;
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      if (this.inFlight > 0) {
        this.scheduleReload();
        return;
      }
      void this.reload();
    }, 800);
  }

  private toList(row: ShoppingListRow, userId: string): ShoppingList {
    const members = row.list_members ?? [];
    const mine = members.find((m) => m.user_id === userId);
    return {
      id: row.id,
      name: row.name,
      month: row.month,
      year: row.year,
      countryCode: row.country_code,
      currency: row.currency as CurrencyCode,
      currencySymbol: row.currency_symbol,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ownerId: row.owner_id,
      familyId: row.family_id,
      role: row.owner_id === userId || mine?.role === 'admin' ? 'admin' : 'editor',
      memberCount: members.length,
      purgeAt: row.purge_at,
      items: (row.list_items ?? []).map((item) => this.toItem(item)).sort((a, b) => a.addedAt.localeCompare(b.addedAt)),
    };
  }

  private toItem(row: ListItemRow): ListItem {
    return {
      id: row.id,
      productQuery: row.product_query,
      desiredPresentation: row.desired_presentation,
      quantity: row.quantity,
      purchased: row.purchased,
      offer: row.offer,
      addedAt: row.added_at,
      addedBy: row.added_by,
    };
  }

  private safeQuantity(quantity: number): number {
    return isValidQuantity(quantity) ? quantity : 1;
  }

  private patch(listId: string, fn: (list: ShoppingList) => ShoppingList): void {
    this.listsState.update((lists) => lists.map((l) => (l.id === listId ? fn(l) : l)));
  }

  private patchItem(listId: string, itemId: string, fn: (item: ListItem) => ListItem): void {
    this.patch(listId, (list) => ({ ...list, items: list.items.map((i) => (i.id === itemId ? fn(i) : i)) }));
  }
}
