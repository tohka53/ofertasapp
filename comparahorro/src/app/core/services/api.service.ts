import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { locationLabel, usesPostalCode } from '../logic/location';
import type {
  ApiErrorBody,
  AppMessage,
  Country,
  LocationResolution,
  LocationsResponse,
  RefreshItemRequest,
  RefreshResponse,
  SearchResponse,
  StoresResponse,
} from '../models/api.models';
import type { LocationSelection } from '../models/app.models';

const API = '/api';

/** Error de la API como mensaje con código (se traduce al mostrarse). */
export function describeApiError(error: unknown): AppMessage {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    const code = body?.error?.code;
    if (code) return body?.error?.params ? { code, params: body.error.params } : { code };
    if (error.status === 0 || error.status >= 500) return { code: 'api_unreachable' };
    return { code: 'http_error', params: { status: error.status } };
  }
  return error instanceof Error ? { code: 'unexpected_error', params: { detail: error.message } } : { code: 'unexpected_error' };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  countries(): Observable<Country[]> {
    return this.http.get<{ countries: Country[] }>(`${API}/countries`).pipe(map((r) => r.countries));
  }

  stores(countryCode: string, checkStatus: boolean, state: string | null = null): Observable<StoresResponse> {
    let params = new HttpParams().set('checkStatus', String(checkStatus));
    if (state) params = params.set('state', state);
    return this.http.get<StoresResponse>(`${API}/countries/${encodeURIComponent(countryCode)}/stores`, { params });
  }

  locations(countryCode: string): Observable<LocationsResponse> {
    return this.http.get<LocationsResponse>(`${API}/countries/${encodeURIComponent(countryCode)}/locations`);
  }

  resolveLocation(countryCode: string, storeIds: string[], location: LocationSelection): Observable<LocationResolution[]> {
    return this.http
      .post<{ results: LocationResolution[] }>(`${API}/locations/resolve`, { countryCode, storeIds, location: this.locationBody(location) })
      .pipe(map((r) => r.results));
  }

  search(countryCode: string, query: string, storeIds: string[], location: LocationSelection | null): Observable<SearchResponse> {
    const params = this.locationParams(new HttpParams().set('country', countryCode).set('q', query).set('stores', storeIds.join(',')), location);
    return this.http.get<SearchResponse>(`${API}/search`, { params });
  }

  offers(countryCode: string, query: string, storeIds: string[], location: LocationSelection | null): Observable<SearchResponse> {
    let params = new HttpParams().set('country', countryCode).set('stores', storeIds.join(','));
    if (query.trim()) params = params.set('q', query.trim());
    return this.http.get<SearchResponse>(`${API}/offers`, { params: this.locationParams(params, location) });
  }

  byGtin(countryCode: string, gtin: string, storeIds: string[], location: LocationSelection | null): Observable<SearchResponse> {
    const params = this.locationParams(new HttpParams().set('country', countryCode).set('gtin', gtin).set('stores', storeIds.join(',')), location);
    return this.http.get<SearchResponse>(`${API}/products/by-gtin`, { params });
  }

  refresh(countryCode: string, items: RefreshItemRequest[], alternativeStoreIds: string[], location: LocationSelection | null): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${API}/products/refresh`, {
      countryCode,
      items,
      alternativeStoreIds,
      location: location ? this.locationBody(location) : null,
    });
  }

  private label(location: LocationSelection): string {
    return locationLabel(location, this.i18n.lang()).slice(0, 80);
  }

  private locationParams(params: HttpParams, location: LocationSelection | null): HttpParams {
    if (!location) return params;
    if (usesPostalCode(location)) return params.set('postalCode', location.postalCode!).set('locationLabel', this.label(location));
    if (location.lat !== null && location.lng !== null) {
      return params.set('lat', location.lat.toFixed(6)).set('lng', location.lng.toFixed(6)).set('locationLabel', this.label(location));
    }
    return params;
  }

  private locationBody(location: LocationSelection): { postalCode: string | null; label: string | null; lat: number | null; lng: number | null } | null {
    if (usesPostalCode(location)) return { postalCode: location.postalCode, label: this.label(location), lat: null, lng: null };
    if (location.lat !== null && location.lng !== null) return { postalCode: null, label: this.label(location), lat: location.lat, lng: location.lng };
    return null;
  }
}
