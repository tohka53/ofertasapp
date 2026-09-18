import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/** Canal para limpiar todo el estado en memoria al iniciar o cerrar sesión. */
@Injectable({ providedIn: 'root' })
export class SessionEventsService {
  private readonly resetSubject = new Subject<void>();
  readonly reset$: Observable<void> = this.resetSubject.asObservable();

  emitReset(): void {
    this.resetSubject.next();
  }
}
