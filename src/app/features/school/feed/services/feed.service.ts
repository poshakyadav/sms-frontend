// features/school/feed/services/feed.service.ts

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import {
  CreateFeedEntryInput,
  DeleteFeedPostResponse,
  FeedReactionType,
  ListFeedParams,
  PaginatedFeedResult,
  PresignImageRequest,
  PresignImageResponse,
  ReactToPostResponse,
  RemoveReactionResponse,
  SingleFeedPostResponse,
  UpdateFeedPostInput,
} from '../models/feed.models';

// ─────────────────────────────────────────────────────────────────────────────
// NOTE on ApiService import path:
// Your AcademicsService/AuthService import ApiService via a relative path that
// suggests it lives in a core/services folder (inferred from project
// structure conventions). If your actual path differs, this is the one line
// to adjust — everything else is path-independent.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FeedService {
  constructor(private api: ApiService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST / READ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetches the feed. The backend filters by audience automatically based on
   * the caller's role (STUDENT / STUDENT_PARENT / staff) — this method just
   * passes pagination + optional filters through.
   *
   * Confirmed: authInterceptor's buildHeaders() already attaches
   * X-Active-Child-Id automatically for any 'school/' request (excluding
   * '/auth/' endpoints) whenever auth.userRole() === 'STUDENT_PARENT', using
   * ParentService.activeChildId(). No header handling needed here.
   */
  listFeed(params: ListFeedParams = {}): Observable<PaginatedFeedResult> {
    let httpParams = new HttpParams();

    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }
    if (params.contentType) {
      httpParams = httpParams.set('contentType', params.contentType);
    }
    if (params.publishedOnly !== undefined) {
      httpParams = httpParams.set('publishedOnly', params.publishedOnly.toString());
    }

    return this.api.get<PaginatedFeedResult>('school/feed/posts', httpParams);
  }

  getPost(id: number): Observable<SingleFeedPostResponse> {
    return this.api.get<SingleFeedPostResponse>(`school/feed/posts/${id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE / UPDATE / DELETE  (admin only — backend enforces feed.post.create /
  // feed.post.manage; this service does not re-check permissions, the route
  // guard + permissionGuard on the admin route already do that)
  // ═══════════════════════════════════════════════════════════════════════════

  createPost(data: CreateFeedEntryInput): Observable<SingleFeedPostResponse> {
    return this.api.post<SingleFeedPostResponse>('school/feed/posts', data);
  }

  updatePost(id: number, data: UpdateFeedPostInput): Observable<SingleFeedPostResponse> {
    return this.api.patch<SingleFeedPostResponse>(`school/feed/posts/${id}`, data);
  }

  togglePin(id: number, isPinned: boolean): Observable<SingleFeedPostResponse> {
    return this.api.patch<SingleFeedPostResponse>(`school/feed/posts/${id}/pin`, { isPinned });
  }

  deletePost(id: number): Observable<DeleteFeedPostResponse> {
    return this.api.delete<DeleteFeedPostResponse>(`school/feed/posts/${id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE PRESIGN  (admin only — called by FeedImageService, not directly by
  // components)
  // ═══════════════════════════════════════════════════════════════════════════

  presignImage(data: PresignImageRequest): Observable<PresignImageResponse> {
    return this.api.post<PresignImageResponse>('school/feed/presign-image', data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIONS  (any viewer — student, parent, staff)
  // ═══════════════════════════════════════════════════════════════════════════

  react(postId: number, reactionType: FeedReactionType): Observable<ReactToPostResponse> {
    return this.api.post<ReactToPostResponse>(`school/feed/posts/${postId}/react`, {
      reactionType,
    });
  }

  removeReaction(postId: number): Observable<RemoveReactionResponse> {
    return this.api.delete<RemoveReactionResponse>(`school/feed/posts/${postId}/react`);
  }
}
