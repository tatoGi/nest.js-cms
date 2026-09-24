// Single source of truth for every Socket.IO event name the chat gateway
// subscribes to or emits — every @SubscribeMessage(...) decorator and every
// .emit(...) call in chat.gateway.ts should reference one of these instead
// of an inline string literal, so a typo becomes a compile error instead of
// a silently-dead handler/listener. CMS and Website each keep their own
// hand-mirrored copy of the subset they consume (see those repos'
// chat-events.constants.ts) — there's no package boundary connecting the
// three, so this file is canonical but not compiler-enforced across repos.
export const CHAT_EVENTS = {
  // ── Visitor → server ──────────────────────────────────────────
  VISITOR_START: 'visitor:start',
  VISITOR_MESSAGE: 'visitor:message',
  VISITOR_CLOSE_SESSION: 'visitor:close_session',
  VISITOR_LEAVE_CONTACT_INFO: 'visitor:leave_contact_info',
  VISITOR_TYPING: 'visitor:typing',
  VISITOR_RATE_SESSION: 'visitor:rate_session',
  VISITOR_READ: 'visitor:read',
  VISITOR_REJOIN: 'visitor:rejoin',
  // Debounced "still filling out the contact form" ping from the widget —
  // re-arms queueAbandonTimers the same way visitor:message does, so a
  // visitor actively typing into queue_contact_offer/queue_wait's contact
  // form isn't warned/auto-closed out from under them mid-fill. See
  // chat.gateway.ts's handleVisitorFormActivity.
  VISITOR_FORM_ACTIVITY: 'visitor:form_activity',

  // ── Operator → server ──────────────────────────────────────────
  OPERATOR_JOIN: 'operator:join',
  OPERATOR_SET_STATUS: 'operator:set_status',
  OPERATOR_JOIN_SESSION: 'operator:join_session',
  OPERATOR_MESSAGE: 'operator:message',
  OPERATOR_CLOSE_SESSION: 'operator:close_session',
  OPERATOR_REOPEN_SESSION: 'operator:reopen_session',
  OPERATOR_INTERNAL_NOTE: 'operator:internal_note',
  OPERATOR_TYPING: 'operator:typing',

  // ── DM → server ──────────────────────────────────────────────
  DM_OPEN: 'dm:open',
  DM_MESSAGE: 'dm:message',
  DM_TYPING: 'dm:typing',

  // ── Server → client (chat/session) ────────────────────────────
  CHAT_MESSAGE: 'chat:message',
  CHAT_CLOSE_CONFIRM_MESSAGE: 'chat:close_confirm_message',
  CHAT_SESSION_ENDED_MESSAGE: 'chat:session_ended_message',
  CHAT_QUEUE_CLOSE_CONFIRM_MESSAGE: 'chat:queue_close_confirm_message',
  CHAT_QUEUE_WAIT_MESSAGE: 'chat:queue_wait_message',
  CHAT_QUEUE_CONTACT_OFFER: 'chat:queue_contact_offer',
  // Fired once, while still queued and unassigned (business hours or not),
  // if queue_abandon_warning is about to close the session with no response
  // — see chat.gateway.ts's queueAbandonTimers.
  CHAT_QUEUE_ABANDON_WARNING: 'chat:queue_abandon_warning',
  CHAT_INACTIVITY_WARNING: 'chat:inactivity_warning',
  CHAT_AUTO_CLOSED: 'chat:auto_closed',
  CHAT_ERROR: 'chat:error',
  CHAT_PERMISSION_ERROR: 'chat:permission_error',
  CHAT_CAPACITY_REACHED: 'chat:capacity_reached',
  SESSION_UPDATED: 'session:updated',
  SESSION_CLOSED: 'session:closed',
  SESSION_REOPENED: 'session:reopened',
  SESSION_REJOINED: 'session:rejoined',

  // ── Server → client (operator presence) ───────────────────────
  OPERATOR_NEW_SESSION: 'operator:new_session',
  OPERATOR_ONLINE: 'operator:online',
  OPERATOR_OFFLINE: 'operator:offline',
  OPERATOR_STATUS_CHANGED: 'operator:status_changed',
  OPERATORS_ONLINE_LIST: 'operators:online_list',
  OPERATORS_STATUS_LIST: 'operators:status_list',
  // Rotation queue order (operator ids, front = next in line) — broadcast to
  // the 'operators' room any time it changes (join/leave eligibility, or an
  // assignment advancing the rotation). See docs/chat.md and
  // OperatorRotationService.
  OPERATOR_QUEUE_UPDATED: 'operator:queue_updated',

  // ── Server → client (DM) ───────────────────────────────────────
  DM_OPENED: 'dm:opened',
  DM_NEW_MESSAGE: 'dm:new_message',
  DM_ERROR: 'dm:error',
} as const;

export type ChatEventName = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];
