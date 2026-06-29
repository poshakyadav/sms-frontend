// src/app/features/school/whatsapp/types/whatsapp.types.ts

// ── Status enums (mirror backend) ────────────────────────────────────────────

export type WhatsappMessageStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'TEMPLATE_ERROR';

export type WhatsappRecipientType = 'PARENT' | 'STUDENT' | 'STAFF' | 'EXTERNAL';

export type WhatsappTemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

export type BulkSendStatus = 'DRAFT' | 'SENDING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export type BulkTargetType =
  | 'ALL_PARENTS'
  | 'ALL_STUDENTS'
  | 'ALL_STAFF'
  | 'CLASS_SECTION_PARENTS'
  | 'CLASS_SECTION_STUDENTS'
  | 'CUSTOM_USER_LIST'
  | 'CUSTOM_PHONE_LIST';

// ── Template definition (from backend PLATFORM_TEMPLATES) ─────────────────────

export interface TemplateDefinition {
  key: string;
  name: string;
  category: WhatsappTemplateCategory;
  language: string;
  bodyText: string;
  variables: string[];
  description: string;
}

// ── Local template cache row (from DB, after sync) ────────────────────────────

export interface WhatsappTemplate {
  id: number;
  name: string;
  language: string;
  category: WhatsappTemplateCategory;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  bodyPreview: string;
  variableNames: string;
  lastSyncedAt: string | null;
}

// ── Balance ───────────────────────────────────────────────────────────────────

export interface WhatsappBalance {
  totalCreditsEverPurchased: number;
  creditsUsed: number;
  creditsRemaining: number;
  lastPurchaseAt: string | null;
}

// ── Outbound message row ──────────────────────────────────────────────────────

export interface WhatsappMessage {
  id: number;
  recipientName: string;
  recipientPhone: string;
  recipientType: WhatsappRecipientType;
  templateName: string;
  templateCategory: WhatsappTemplateCategory;
  status: WhatsappMessageStatus;
  waMessageId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  creditsUsed: number;
  triggeredByModule: string | null;
  bulkSendId: number | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

// ── Bulk send row ─────────────────────────────────────────────────────────────

export interface BulkSend {
  id: number;
  title: string;
  templateName: string;
  templateCategory: WhatsappTemplateCategory;
  targetType: BulkTargetType;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  creditsDeducted: number;
  status: BulkSendStatus;
  createdAt: string;
  completedAt: string | null;
}

// ── Inbound message row ───────────────────────────────────────────────────────

export interface WhatsappInboundMessage {
  id: number;
  fromPhone: string;
  fromName: string | null;
  fromUserId: number | null;
  waMessageId: string;
  messageType: string;
  textBody: string | null;
  receivedAt: string;
  createdAt: string;
}

// ── Service I/O shapes ────────────────────────────────────────────────────────

export interface SendSingleInput {
  templateKey: string;
  recipientPhone: string;
  recipientName: string;
  recipientType: WhatsappRecipientType;
  recipientUserId?: number;
  variables: Record<string, string>;
  triggeredByModule?: string;
  triggeredByEntityId?: number;
}

export interface BulkInitiateInput {
  title: string;
  templateKey: string;
  targetType: BulkTargetType;
  classSectionId?: number;
  userIds?: number[];
  phoneList?: string[];
  variableResolver: 'auto';
}

export interface BulkInitiateResult {
  bulkSendId: number;
  totalRecipients: number;
  estimatedCreditCost: number;
  creditsRemaining: number;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: number;
  wamid?: string;
  error?: string;
}

// ── Template keys (all 14 approved templates) ─────────────────────────────────

export const ALL_TEMPLATE_KEYS = [
  'MONTHLY_FEE_DUE',
  'FEE_PAYMENT_CONFIRMED',
  'FEE_OVERDUE_ALERT',
  'STUDENT_FEE_ASSIGNED',
  'EXAM_SCHEDULE_PUBLISHED',
  'ADMIT_CARD_PUBLISHED',
  'RESULT_PUBLISHED',
  'STUDENT_ABSENT_TODAY',
  'LOW_ATTENDANCE_WARNING',
  'ADMISSION_CONFIRMED',
  'ASSIGNMENT_DUE_REMINDER',
  'GENERAL_NOTIFICATION',
  'HOLIDAY_NOTICE',
  'PTM_INVITE',
] as const;

export type PlatformTemplateKey = (typeof ALL_TEMPLATE_KEYS)[number];

// ── Label helpers ─────────────────────────────────────────────────────────────

export const TARGET_TYPE_LABELS: Record<BulkTargetType, string> = {
  ALL_PARENTS: 'All parents',
  ALL_STUDENTS: 'All students',
  ALL_STAFF: 'All staff',
  CLASS_SECTION_PARENTS: 'Class section — parents',
  CLASS_SECTION_STUDENTS: 'Class section — students',
  CUSTOM_USER_LIST: 'Custom user list',
  CUSTOM_PHONE_LIST: 'Custom phone list',
};

export const TEMPLATE_CATEGORY_LABELS: Record<WhatsappTemplateCategory, string> = {
  UTILITY: 'Utility',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Authentication',
};

export const STATUS_LABELS: Record<WhatsappMessageStatus, string> = {
  QUEUED: 'Queued',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  READ: 'Read',
  FAILED: 'Failed',
  TEMPLATE_ERROR: 'Template error',
};

export const BULK_STATUS_LABELS: Record<BulkSendStatus, string> = {
  DRAFT: 'Draft',
  SENDING: 'Sending...',
  COMPLETED: 'Completed',
  PARTIAL: 'Partially sent',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
