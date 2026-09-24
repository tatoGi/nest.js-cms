import type { ExcelColumnDef } from '@/common/excel/excel-stream-writer';
import { formatInTbilisi } from './timezone.util';

// Same columns/order/labels as the CMS's Chat History table — keep these
// two in sync if that table's columns ever change.
export const CHAT_HISTORY_EXPORT_COLUMNS: ExcelColumnDef[] = [
  { header: 'კლიენტი', key: 'client', width: 22 },
  { header: 'აგენტი', key: 'agent', width: 20 },
  { header: 'დაწყება', key: 'start', width: 20 },
  { header: 'დასრულება', key: 'end', width: 20 },
  { header: 'მოლოდინი', key: 'waiting', width: 14 },
  { header: 'ხანგრძლივობა', key: 'duration', width: 14 },
  { header: 'ენა', key: 'language', width: 10 },
  { header: 'IP', key: 'ip', width: 18 },
  { header: 'დახურვის მიზეზი', key: 'closeReason', width: 22 },
  { header: 'კონტაქტი დატოვებულია', key: 'contactInfoLeft', width: 18 },
  { header: 'შეფასება', key: 'rating', width: 12 },
  { header: 'შეფასების კომენტარი', key: 'ratingComment', width: 32 },
  { header: 'რეგიონი', key: 'region', width: 18 },
  { header: 'პროგრამა', key: 'program', width: 22 },
  { header: 'კომენტარი', key: 'comment', width: 32 },
];

// Second sheet — every session with contactInfoLeft true, with the merged
// "დატოვებული კონტაქტი" column from the main sheet split back out into its
// individual fields plus a dedicated mail-status column, since this sheet
// exists specifically to audit those submissions and their delivery status.
// closeReason/agent/region/program/comment are omitted — not relevant to
// auditing a contact submission. visitorPhone/visitorEmail (collected on the
// intro form when the chat started) are included alongside the
// contactRequest* fields (submitted later via the "leave contact info" form,
// which may override them) so both are visible side by side.
export const CONTACT_REQUESTS_EXPORT_COLUMNS: ExcelColumnDef[] = [
  { header: 'კლიენტი', key: 'client', width: 22 },
  { header: 'ტელეფონი', key: 'visitorPhone', width: 20 },
  { header: 'ელფოსტა', key: 'visitorEmail', width: 24 },
  { header: 'დაწყება', key: 'start', width: 20 },
  { header: 'დასრულება', key: 'end', width: 20 },
  { header: 'ენა', key: 'language', width: 10 },
  { header: 'IP', key: 'ip', width: 18 },
  { header: 'მეილის სტატუსი', key: 'mailStatus', width: 18 },
  { header: 'დატოვებული სახელი', key: 'contactRequestName', width: 20 },
  { header: 'დატოვებული ტელეფონი', key: 'contactRequestPhone', width: 18 },
  { header: 'დატოვებული ელფოსტა', key: 'contactRequestEmail', width: 24 },
  { header: 'დატოვებული შეტყობინება', key: 'contactRequestMessage', width: 32 },
];

// Explicitly formatted in the business timezone (Asia/Tbilisi), not the
// server process's own OS timezone — Date#getHours() etc. would silently
// shift every exported time if the server isn't also running in that zone,
// which is what produced the "wrong hours" bug report.
function formatDateTime(date: Date | null): string {
  if (!date) return '—';
  return formatInTbilisi(date);
}

// H:MM:SS, matching the CMS table's own formatDuration.
function formatDuration(from: Date | null, to: Date | null): string {
  if (!from || !to) return '—';
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface ChatHistoryExportRow {
  visitorName: string | null;
  visitorPhone: string | null;
  visitorEmail: string | null;
  operator: { displayName: string } | null;
  startedAt: Date;
  closedAt: Date | null;
  assignedAt: Date | null;
  visitorLanguage: string | null;
  visitorIp: string | null;
  resolutionTag: string | null;
  contactInfoLeft: boolean;
  contactRequestName: string | null;
  contactRequestPhone: string | null;
  contactRequestEmail: string | null;
  contactRequestMessage: string | null;
  contactRequestEmailSent: boolean | null;
  visitorRating: number | null;
  visitorRatingComment: string | null;
  region: { name: string } | null;
  program: { name: string } | null;
  closureSummary: string | null;
}

export function toChatHistoryExportRecord(row: ChatHistoryExportRow) {
  return {
    client: row.visitorName ?? 'ანონიმური',
    agent: row.operator?.displayName ?? '—',
    start: formatDateTime(row.startedAt),
    end: formatDateTime(row.closedAt),
    waiting: formatDuration(row.startedAt, row.assignedAt),
    duration: formatDuration(row.startedAt, row.closedAt),
    language: row.visitorLanguage?.toUpperCase() ?? '—',
    ip: row.visitorIp ?? '—',
    closeReason: row.resolutionTag ?? '—',
    contactInfoLeft: row.contactInfoLeft ? 'დიახ' : 'არა',
    rating: row.visitorRating ?? '—',
    ratingComment: row.visitorRatingComment ?? '—',
    region: row.region?.name ?? '—',
    program: row.program?.name ?? '—',
    comment: row.closureSummary ?? '—',
  };
}

// True for the rows the second (contact-requests) sheet should include.
export function isContactRequestRow(row: ChatHistoryExportRow): boolean {
  return row.contactInfoLeft;
}

// Only ever called for rows where isContactRequestRow(row) is true.
export function toContactRequestExportRecord(row: ChatHistoryExportRow) {
  return {
    client: row.visitorName ?? 'ანონიმური',
    visitorPhone: row.visitorPhone ?? '—',
    visitorEmail: row.visitorEmail ?? '—',
    start: formatDateTime(row.startedAt),
    end: formatDateTime(row.closedAt),
    language: row.visitorLanguage?.toUpperCase() ?? '—',
    ip: row.visitorIp ?? '—',
    mailStatus: row.contactRequestEmailSent ? 'მეილი გაიგზავნა' : 'მეილი ვერ გაიგზავნა',
    contactRequestName: row.contactRequestName ?? '—',
    contactRequestPhone: row.contactRequestPhone ?? '—',
    contactRequestEmail: row.contactRequestEmail ?? '—',
    contactRequestMessage: row.contactRequestMessage ?? '—',
  };
}
