// api.service.ts

import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = environment.apiUrl; // from environment (e.g., 'http://localhost:8787' dev, prod URL)

  constructor(private http: HttpClient) {}

  // GET
  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${this.baseUrl}/${path}`, { params })
      .pipe(catchError(this.handleError));
  }

  // POST
  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body).pipe(catchError(this.handleError));
  }

  // PUT
  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body).pipe(catchError(this.handleError));
  }

  // PATCH
  patch<T>(path: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${path}`, body).pipe(catchError(this.handleError));
  }

  // DELETE
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`).pipe(catchError(this.handleError));
  }

  // ── Error handler ────────────────────────────────────────────────────────
  // CRITICAL: always re-throw the original HttpErrorResponse intact.
  //
  // Previously this threw `error.error?.message || 'Server error'` — a plain
  // string. That silently discarded the parsed response body (including
  // `requiresTermsAcceptance`, `requiresPayment`, etc.) before it could reach
  // any catchError in auth.service.ts or any component catch block.
  //
  // Rule: ApiService is a transport layer. It must never transform errors into
  // a lossy type. Callers (services, components) decide what to do with them.
  private handleError(error: HttpErrorResponse): Observable<never> {
    // Log for local debugging — safe to keep in production (no sensitive data
    // in the HttpErrorResponse itself, only metadata and the parsed body).
    console.error('API Error:', error);

    // Re-throw the original HttpErrorResponse so every layer above receives:
    //   err.status        → HTTP status code (403, 401, 500 …)
    //   err.error         → parsed JSON body from the backend
    //   err.message       → Angular's human-readable description
    return throwError(() => error);
  }
}
