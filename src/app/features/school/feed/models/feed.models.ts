// features/school/feed/models/feed.models.ts

// ─────────────────────────────────────────────────────────────────────────────
// These mirror the backend exactly:
//   - src/db/schemas/school/school-feed-posts.ts        (FeedContentType, FeedTargetAudience)
//   - src/db/schemas/school/school-feed-post-interactions.ts (FeedReactionType)
//   - src/modules/school/feed/services.ts                (FeedPostWithMeta, PaginatedFeedResult)
//   - src/modules/school/feed/validators.ts               (Create/Update/Query input shapes)
// ─────────────────────────────────────────────────────────────────────────────

export type FeedContentType = 'POST' | 'VIDEO';

export type FeedTargetAudience =
  | 'ALL_SCHOOL'
  | 'STUDENTS_ONLY'
  | 'PARENTS_ONLY'
  | 'CLASS_SECTION'
  | 'CLASS_SECTION_STUDENTS'
  | 'CLASS_SECTION_PARENTS';

export const FEED_TARGET_AUDIENCE_OPTIONS: { value: FeedTargetAudience; label: string }[] = [
  { value: 'ALL_SCHOOL', label: 'Entire School' },
  { value: 'STUDENTS_ONLY', label: 'All Students' },
  { value: 'PARENTS_ONLY', label: 'All Parents' },
  { value: 'CLASS_SECTION', label: 'Specific Class-Section (Everyone)' },
  { value: 'CLASS_SECTION_STUDENTS', label: 'Specific Class-Section (Students Only)' },
  { value: 'CLASS_SECTION_PARENTS', label: 'Specific Class-Section (Parents Only)' },
];

/** Audiences that require a classSectionId to be set alongside them. */
export const CLASS_SCOPED_AUDIENCES: ReadonlySet<FeedTargetAudience> = new Set([
  'CLASS_SECTION',
  'CLASS_SECTION_STUDENTS',
  'CLASS_SECTION_PARENTS',
]);

export type FeedReactionType = 'LIKE' | 'LOVE' | 'CLAP' | 'INSIGHTFUL';

export const FEED_REACTION_OPTIONS: { value: FeedReactionType; emoji: string; label: string }[] = [
  { value: 'LIKE', emoji: '👍', label: 'Like' },
  { value: 'LOVE', emoji: '❤️', label: 'Love' },
  { value: 'CLAP', emoji: '👏', label: 'Clap' },
  { value: 'INSIGHTFUL', emoji: '💡', label: 'Insightful' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST SHAPE — exactly matches FeedPostWithMeta from services.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedPost {
  id: number;
  schoolId: number;
  createdBy: number | null;
  createdByName: string;
  contentType: FeedContentType;

  // POST fields
  postText: string | null;
  imageUrl: string | null;
  imageKey: string | null;

  // VIDEO fields
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  videoTitle: string | null;
  videoDescription: string | null;

  // Targeting
  targetAudience: FeedTargetAudience;
  classSectionId: number | null;

  // Lifecycle
  isPublished: boolean;
  isPinned: boolean;

  createdAt: string;
  updatedAt: string;

  // Enrichment
  reactions: Record<string, number>;
  myReaction: FeedReactionType | null;
  classSectionLabel: string | null;
}

export interface PaginatedFeedResult {
  success: boolean;
  posts: FeedPost[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST QUERY PARAMS — matches listFeedQuerySchema
// ─────────────────────────────────────────────────────────────────────────────

export interface ListFeedParams {
  limit?: number;
  offset?: number;
  contentType?: FeedContentType;
  publishedOnly?: boolean; // admin-only — students/parents always get true server-side
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INPUT — matches createFeedPostSchema discriminated union
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateFeedPostBase {
  targetAudience: FeedTargetAudience;
  classSectionId?: number | null;
  isPublished?: boolean;
}

export interface CreateFeedPostInput extends CreateFeedPostBase {
  contentType: 'POST';
  postText: string;
  imageUrl?: string;
  imageKey?: string;
}

export interface CreateFeedVideoInput extends CreateFeedPostBase {
  contentType: 'VIDEO';
  youtubeUrl: string;
  videoTitle: string;
  videoDescription?: string;
}

export type CreateFeedEntryInput = CreateFeedPostInput | CreateFeedVideoInput;

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INPUT — matches updateFeedPostSchema (all optional, PATCH semantics)
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateFeedPostInput {
  targetAudience?: FeedTargetAudience;
  classSectionId?: number | null;
  isPublished?: boolean;
  isPinned?: boolean;

  postText?: string;
  imageUrl?: string | null;
  imageKey?: string | null;

  youtubeUrl?: string;
  videoTitle?: string;
  videoDescription?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESIGN IMAGE — matches presignImageSchema + generateFeedImagePresignedUrl return
// ─────────────────────────────────────────────────────────────────────────────

export interface PresignImageRequest {
  contentType: 'image/webp' | 'image/jpeg' | 'image/png';
  fileSizeBytes: number;
}

export interface PresignImageResponse {
  success: boolean;
  presignedUrl: string;
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ReactToPostResponse {
  success: boolean;
  action: 'created' | 'updated';
  reactionType: FeedReactionType;
  reactions: Record<string, number>;
}

export interface RemoveReactionResponse {
  success: boolean;
  removed: boolean;
  reactions: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE / CREATE / UPDATE / DELETE response wrappers
// ─────────────────────────────────────────────────────────────────────────────

export interface SingleFeedPostResponse {
  success: boolean;
  post: FeedPost;
}

export interface DeleteFeedPostResponse {
  success: boolean;
  message: string;
}
