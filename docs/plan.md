# Chat System Fixes — Implementation Plan

## Context

The client (operators using the live-chat feature across the CMS and the public website widget) reported 11 issues after real-world usage, ranging from audio/notification bugs to reporting/timezone problems to UX gaps. The goal is to fix the root causes across three repos — `Enterprise_Georgia_Backend` (NestJS/Prisma/Socket.IO), `Enterprise_CMS` (operator UI, Next.js), and `Enterprise-georgia-NFront` (public website chat widget, Next.js) — without expanding scope beyond what was reported.

Full codebase investigation (via Explore agents) already pinpointed exact files/lines for the root cause of every item except #5 (visual bubble styling, needs client design direction) and partially #6 (needs a small spec clarification on time format). Decisions below were confirmed with the client:

- **Item 9** (keyword filter): expand to include closure summary + assigned operator name only (not full message-body search — that's a bigger, higher-risk follow-up).
- **Item 10** (rich text): scope to canned responses only, not automatic messages.
- **Item 3** (logout): frontend fix only; no backend force-disconnect safeguard for now.

Work is grouped into 6 independent streams (A–F) plus one stream (G) that's blocked on design input.

---

## Stream A — Notification/Sound Scoping (Items 1, 2, 4)

**Root cause:** CMS plays alert sounds for every incoming-message/new-session broadcast regardless of which operator the chat is actually assigned to; and the shared Web Audio `AudioContext` is never resumed after the browser auto-suspends it, causing intermittent silent failures.

### A1. Role-based sound scoping (items 1, 2)

Two different sound types need two different scoping rules, split by role:

- **New-chat alarm** (`OPERATOR_NEW_SESSION` — a new incoming chat entering the queue): only **supervisors** should hear this for all incoming chats, regardless of assignment. Regular operators should NOT hear this alarm for chats not assigned to them — even unassigned/queue chats. (This is a change from the current behavior, which rings this for everyone including regular operators — confirmed intentional per client.)
- **Message send/receive sound** (`CHAT_MESSAGE`): scoped to the chat's assigned operator ONLY, for everyone — including supervisors. A supervisor should not hear message-level sounds for another operator's active conversation, only the new-chat alarm above.

Implementation:

- `Enterprise_CMS/src/components/features/chat/hooks/useChatAlerts.ts`:
  - `handleMessage` (~lines 70-96, drives `CHAT_MESSAGE`/send-receive sound): change the guard to require `session.operatorId === currentOperatorId` unconditionally (remove the `isUnassigned` bypass for this sound — message sounds should never ring for anyone but the assigned operator, supervisor or not).
  - `handleNewSession`/new-chat-alarm path (~lines 66-68, drives `OPERATOR_NEW_SESSION`): gate on `isSupervisor` (need to determine the correct permission check — likely the same `canViewAllChats`/`CHAT_CLOSE`-style permission already used for the "My chats" toggle scope, confirm exact flag during implementation) instead of ringing for all operators.
- `Enterprise_CMS/src/components/features/chat/ChatClient/index.tsx`: thread both `user?.id` (as `currentOperatorId`) and the supervisor/permission flag (already available via the existing permission hook used elsewhere in this file) into `useChatAlerts`.
- No backend change needed — broadcast payloads already carry `session.operatorId`; client-side gating is sufficient and lower-risk than introducing per-operator/per-role Socket.IO rooms.

### A2. Fix intermittent sound failure (item 4)

- `Enterprise_CMS/src/components/features/chat/hooks/notificationSounds.ts`: before scheduling a sound in `playOnce` (~lines 785-793), check `audioCtx.state === 'suspended'` and `await audioCtx.resume()` first.
- Add a `visibilitychange`/`focus` listener to proactively resume the context when the tab regains focus (browsers re-suspend backgrounded tabs).
- Revisit `stopAllSounds()` (~line 802) being called unconditionally before every play — avoid clipping an in-flight relevant sound when an unrelated event fires moments later.

**Verification:** Three-way multi-tab test (regular operator A, regular operator B, a supervisor) — confirm: (1) message send/receive sounds only fire for A on A's own assigned chats, never for B's or unrelated chats, and never for the supervisor either; (2) the new-chat alarm fires for the supervisor on every incoming chat, but not for regular operators unless assigned to them; (3) "away" doesn't suppress alerts for the operator's own active chat; (4) sound plays reliably (~20 trials) including after backgrounding the tab for 2+ minutes.

---

## Stream B — Operator Logout Ends Chat Presence (Item 3)

**Actual root cause (found during implementation):** the "Sign out" menu item (`Enterprise_CMS/src/components/layout/header/UserDropdown.tsx`) was a Next.js `<Link href="/signout">` pointing at a Route Handler (`src/app/signout/route.ts`) that clears cookies and redirects to `/signin`. Next's client-side router can intercept `<Link>` clicks and perform this as a soft/client-side transition rather than a real browser navigation — the JS execution context (and the chat WebSocket living in `ChatSocketContext`) never actually unloads, so the operator's socket — and their chat presence on the backend — stays alive until the tab is physically closed. `useLogout()` in `useAuth.ts` is unrelated dead code; the real logout flow never goes through it.

- **Fixed**: `UserDropdown.tsx` — changed the sign-out `<Link>` to a plain `<a href="/signout">`, which forces a real full-page navigation and guarantees the socket connection tears down.
- Also fixed on the same route (`signout/route.ts`): behind an nginx reverse proxy that doesn't forward the original `Host` (no `X-Forwarded-Host`), `request.url` resolved to the upstream's own address (e.g. `localhost:3001`) instead of the public domain, sending operators to the wrong sign-in URL after logout. Now builds the redirect/backend-call origin from `x-forwarded-host`/`x-forwarded-proto` headers when present.
- **Revised per stakeholder decision (found during verification):** a real page unload only drops the socket — the gateway's `OPERATOR_DISCONNECT_GRACE_MS` (10 min, see Stream B1 below) then kept the operator showing "online" to supervisors for up to that long, which the stakeholder confirmed is unacceptable — logout must reflect offline within ~1 minute, effectively immediately. Added `ChatGateway.forceOperatorOffline(operatorId)` (`chat.gateway.ts`), called from `AuthService.logout()` right after the DB `refreshToken` clear, which cancels any pending grace timer and marks the operator offline/broadcasts it immediately instead of waiting on the socket-disconnect path at all. Required a circular module dependency between `AuthModule` and `ChatModule` (`forwardRef` on both sides — `auth.module.ts`, `chat.module.ts` — and on the `ChatGateway`/`AuthService` constructor injections).
- **Second, deeper root cause (found verifying the above — the actual reason logout never went offline at all, not just slowly):** `POST /auth/logout` is `@Public()` (deliberately, so logout still succeeds with an already-expired access token) — but `JwtAuthGuard.canActivate` (`guards/jwt-auth.guard.ts` ~line 18) short-circuits to `return true` for public routes _without_ ever invoking the Passport JWT strategy, so `req.user` is never populated on this route. `AuthController.logout` was reading `(req as any).user?.userId`, which was therefore always `undefined` — meaning the `if (userId)` branch in `AuthService.logout` (DB `refreshToken` clear, and the new `forceOperatorOffline` call above) **never ran, on any logout, ever** — this was true before this stream's changes too, not a regression. Fixed by decoding the operator id directly from the `accessToken` cookie instead of trusting `req.user`: new `AuthService.decodeUserIdFromAccessToken()` (`jwtService.verify(token, { ignoreExpiration: true })`, mirroring the existing manual-decode pattern already used in `refreshToken()` for the refresh-token cookie), called from `AuthController.logout` before invoking the service.
- **Third root cause, and the one that actually explained the remaining production-only symptom (found via temporary diagnostic logging + a self-referential-fetch fix that turned out not to be the answer either):** two contributing issues on the CMS side, both now fixed:
  - `signout/route.ts`'s backend call went through the public origin (`BASE_PATH` + this server's own domain), which makes the CMS server hairpin back to its own public IP/domain — some cloud/VPS network paths mishandle that self-referential round trip even though an ordinary browser request through the same nginx works fine. Changed to call the backend directly via `API_INTERNAL_URL` (mirrors what `next.config.ts`'s rewrites already use), sidestepping nginx entirely for this one call.
  - The route also lacked `export const dynamic = "force-dynamic"` — it reads cookies/headers off the raw `Request` instead of `next/headers`' `cookies()`/`headers()`, which is what Next's static-analysis normally looks for to mark a route as request-dependent, so a production build could in principle cache it.
  - **The actual production blocker, though:** none of the above mattered because the deployed `.next/` build on the server was simply stale — `git pull` had brought in the right commits, but the running build predated them (confirmed by grepping the built output for a temporary diagnostic string and finding nothing, despite the source file on disk having it). `rm -rf .next && npm run build` resolved it; both the CMS-side `console.log` and the backend's `logout: forcing operator N offline` log line then appeared exactly as expected, and the operator went offline immediately on the live Monitor. The public-origin vs. `API_INTERNAL_URL` and `force-dynamic` changes are kept regardless, as they're correct hardening even though they weren't the actual cause this time.
- All temporary diagnostic logging (`console.log`/`console.error` in `signout/route.ts`, `logger.warn`/`logger.log` in `auth.service.ts` and `chat.gateway.ts`) has been removed now that the fix is confirmed in production.

**Verification:** Log in as operator, get a chat assigned, log out via the UI (no closing the tab), confirm from a second operator's view (or backend logs) that presence goes offline immediately (not after the 10-min grace). Confirmed working in production on 2026-09-05.

### B1. Follow-up — Auto-away instead of offline on grace-timer expiry — blocked on stakeholder input

**Found during related investigation (not in the original 11 items):** `OPERATOR_DISCONNECT_GRACE_MS` (`chat.gateway.ts` ~line 171, 10 minutes) currently removes the operator entirely from `onlineOperators` and broadcasts `offline` once it expires with no reconnect (e.g. a backgrounded/frozen browser tab that never sends another ping within the window). Proposed alternative: flip the operator's preference to `away` instead of deleting the entry — functionally equivalent for auto-assignment (`away` is already excluded in `computeEligibleOperatorIds`), but shows supervisors a less alarming "away" instead of a hard "offline" disappearance.

- Needs a way to distinguish this **auto**-away from an operator's own manually-chosen away, so a reconnect resets auto-away back to `online` but leaves a manual away untouched (`handleOperatorJoin` ~line 1140 currently preserves `priorPreference` unconditionally on reconnect — would need an `autoAway` flag on `OperatorPresence` to tell the two apart).
- **Blocked:** needs stakeholder sign-off on the UX change before implementing — ask the client whether "away" (implying temporarily-reachable) or the current "offline" (implying gone) is the correct signal to supervisors in this case.

---

## Stream C — Visitor Session Closes on Tab Close (Item 11)

**Root cause:** the backend's `handleDisconnect` intentionally does not close visitor sessions on raw socket disconnect (this preserves refresh/rejoin). Only the ~10-minute inactivity timer eventually closes an abandoned session.

**Revised approach (found during implementation):** the original plan called for a frontend-only fix — a `pagehide` listener on the widget emitting the existing `VISITOR_CLOSE_SESSION` event. That doesn't actually work: `pagehide` fires on an ordinary page **refresh** too, not just real tab-close/navigation-away, and there is no reliable way to distinguish the two from inside the handler before the browser has actually navigated. Firing an immediate, permanent close on every `pagehide` would break the refresh-preserves-session/rejoin behavior — the very thing the plan's own regression check was meant to guard. Implemented a backend-side grace-close on disconnect instead, which handles both cases correctly without relying on unload-event timing:

- `Enterprise_Georgia_Backend/src/modules/chat/chat.gateway.ts`:
  - Added `visitorSessionSockets: Map<socketId, sessionId>` (Socket.IO has already left all rooms by the time the `disconnect` event fires, so `client.rooms` can't be used to look up which session a dropped socket belonged to — this map is the only record of it). Populated in `handleVisitorStart` and `handleVisitorRejoin`.
  - Added `visitorDisconnectTimers: Map<sessionId, Timer>` and a 15-second grace period (`VISITOR_DISCONNECT_GRACE_MS`).
  - `handleDisconnect`: on a visitor-socket disconnect, arms a grace timer (`armVisitorDisconnectTimer`) instead of closing immediately.
  - `handleVisitorRejoin`: cancels the pending grace timer (`cancelVisitorDisconnectTimer`) — an ordinary refresh reconnects almost instantly and the session stays open, exactly like today.
  - New `closeAbandonedVisitorSession(sessionId)` (mirrors `autoCloseForInactivity`): if the grace timer fires with no reconnect, re-checks the session is still `open` (guards against a race with a manual/operator/inactivity close that happened in the meantime) and closes it via the existing `closeSessionWithResolution(..., ChatCloseReason.CLIENT_CLOSED)` path — same event emissions (`SESSION_CLOSED`, session-ended message, queue drain) as a manual visitor close.
  - `handleVisitorCloseSession` (manual X-click close) also cancels any pending grace timer, for cleanliness.
- No website frontend changes were needed — the fix is entirely server-side and requires no new client-side event or `chat-events.constants.ts` changes in either repo.

**Verification:** Start a chat in the widget, close the browser tab (not just navigate within the SPA) — confirm the session closes on the operator/CMS side within ~15 seconds, not after the 10-minute inactivity timeout. Regression-check: refresh mid-chat and confirm the session stays open and rejoin still works (the grace timer should be cancelled well within the window). Also check: a very slow reconnect (e.g. throttled network) that takes longer than 15s should correctly result in the session closing — acceptable per the agreed grace period.

---

## Stream D — Reporting: Timezone Fix + Time-of-Day Filter + No-Results Bug (Items 6, 7, 8)

**Root cause (shared):** `buildChatHistoryWhere` parses `dateFrom` as UTC midnight (`new Date('YYYY-MM-DD')`) but `dateTo` as local-server time (`new Date('YYYY-MM-DDT23:59:59.999')`) — an inconsistent interpretation between the two bounds, neither anchored to the business timezone (`Asia/Tbilisi`, fixed UTC+4, no DST). This causes wrong hours in reports (#7), missing rows for valid ranges (#8), and blocks adding a proper time-of-day filter (#6).

### D1. Backend: timezone-safe range parsing

- `Enterprise_Georgia_Backend/src/modules/chat/application/chat.service.ts`, `buildChatHistoryWhere` (~lines 119-167, bug at 158-164): replace the two inconsistent `new Date(...)` calls with a shared helper (e.g. `resolveTbilisiRangeToUtc`) using a timezone library (check `package.json` for an existing dependency like `date-fns-tz`/`luxon` before adding a new one) that interprets both bounds as `Asia/Tbilisi` wall-clock time consistently, converting to UTC instants.
- Design the helper to accept optional hour/minute from day one, so it directly supports item 6's time-of-day filter without a second refactor.
- Make the helper backward-compatible with bare `YYYY-MM-DD` input (treated as Tbilisi day start/end) so backend and CMS changes can roll out independently.
- `Enterprise_Georgia_Backend/src/modules/chat/application/chat-history-export.ts`, `formatDateTime` (~lines 47-54): replace local `Date#getHours()`-style calls (server-OS-timezone-dependent) with explicit `Asia/Tbilisi` formatting via the same library.
- Reuse or centralize the timezone constant already defined as `BUSINESS_HOURS_TIMEZONE` in `chat.gateway.ts` (~line 434) instead of hardcoding `'Asia/Tbilisi'` in a second place.

### D2. CMS: add time-of-day picker, send full datetime

- `Enterprise_CMS/src/components/common/filter/FilterInputRenderer.tsx` (~lines 178-186): for the chat-history date-range filter specifically, pass `mode="datetime"` to `DateInputPicker` instead of the default `mode="date"` (the component already supports this mode — `DateInputPicker.tsx` line 18, format `Y-m-d H:i` — just isn't used here).
- `chat-history-filters/index.ts` (filter def ~line 71, `toChatHistoryParams` ~lines 94-123): update to send full datetime strings for `dateFrom`/`dateTo` once the picker captures time.
- Spec note: the client's "00/24" phrasing means a 24-hour clock display, which `H:i` format already provides — no separate AM/PM toggle needed.

**Sequencing:** D1 (backend) should land first since it's backward-compatible with bare dates; D2 (CMS) can follow without breaking the interim state.

**Verification:** Unit test the new timezone helper against known instants (e.g. a session at 08:55 Tbilisi time should export as `08:55`, not `04:55:32`). Re-run the client's reported case directly. Confirm a previously-empty date-range query now returns expected rows.

---

## Stream E — Keyword Filter Coverage (Item 9)

**Root cause:** `search` param only matches `visitorName`/`visitorPhone`/`visitorEmail`; the UI labels it "keyword" implying broader matching.

- `Enterprise_Georgia_Backend/src/modules/chat/application/chat.service.ts`, `buildChatHistoryWhere` (~lines 149-157): expand the `OR` array to also match `closureSummary` (already a direct field, already an exported report column) and the assigned operator's display name (via the operator relation).
- Per client decision, do **not** add full message-body search in this round — flag it as a possible future phase if requested (would need a `some()` join against messages and likely a DB index for performance).
- Bundle into the same PR as Stream D since it's the same function/file.

**Verification:** Search by a known closure-summary substring and by operator name, confirm matches appear; confirm existing name/phone/email search still works.

---

## Stream F — Canned Responses Rich Text (Item 10)

**Root cause:** `CannedResponse.body`/`CannedResponseTranslation.body` are plain `String @db.Text` (no schema change needed — they already store arbitrary text/HTML); the CMS form uses a plain `TextArea`.

### F1. CMS: swap in the existing rich text editor, with a restricted toolbar

- `Enterprise_CMS/src/components/features/chat/CannedResponsesClient/TranslationBody.tsx` (~lines 5-14): replace the `TextArea` with the CMS's existing `RichTextEditor` (`Enterprise_CMS/src/components/form/input/RichTextEditor.tsx`, Quill-based via `react-quill-new`, already used in `PostForm.tsx`/`PageForm.tsx`), keeping the same `react-hook-form` `Controller` wiring.
- **Guard the toolbar**: `RichTextEditor.tsx`'s `toolbar`/`formats` are currently hardcoded (module-level, not props — lines 30-57), covering headers/bold/italic/underline/strike/lists/indent/align/link/image/video/clean. Add optional `toolbar`/`formats` props, defaulting to the current full set (so `PostForm.tsx`/`PageForm.tsx` etc. are unaffected). For canned responses, pass a restricted config: `bold`, `italic`, `underline`, ordered/bullet lists, `link`, `clean` — no headers, images, video, indent, or align. This is a UX-level guard (Quill can still be coerced into emitting other HTML via paste), not the security boundary — see F2 below for that.
- **Security boundary is server-side, not the toolbar**: since Quill's HTML output can't be fully trusted client-side regardless of toolbar config, the real guard is sanitization on save (F2).
- Scope: canned responses only, per client decision — do not touch `AutomaticMessagesPanel/` forms.

### F2. Sanitize on write, and keep messages plain text end-to-end (revised during implementation)

**Discovered during implementation:** the original plan assumed canned-response HTML would flow through to the visitor as rendered HTML, and planned a matching render-side sanitizer on both frontends' message bubbles for that. That assumption was wrong — the chat composer (`MessageComposer.tsx`) is a plain `<textarea>`, and `ChatMessage.body` is a plain string end-to-end on **both** the CMS and the website widget; no chat message has ever rendered HTML. Introducing HTML-rendering message bubbles just for this feature would have been a much larger, unrequested change (touching the composer, `ChatMessage` schema/socket payloads, and both frontends' render paths) for a feature that only asked for a nicer _authoring_ experience for canned responses. Implemented instead:

- **Write-side sanitization (the real guard):** added `sanitize-html` as a new backend dependency (none existed before — allowlist-based, the standard choice for Node/NestJS). `Enterprise_Georgia_Backend/src/modules/chat/application/canned-response.service.ts` — new `sanitizeCannedResponseBody()`, allowlisting `b/strong/i/em/u/ul/ol/li/a/p/br` (matching the restricted toolbar), applied in `createCannedResponse`/`updateCannedResponse` to both the top-level `body` and every `translations[code]` value before they reach Prisma. This guards the stored HTML itself (relevant since the rich-text editor round-trips it back through Quill on every edit) and the CMS's own admin preview.
- **Composer insertion converts HTML → plain text:** `Enterprise_CMS/src/components/features/chat/chatUtils.ts` — new `cannedResponseHtmlToPlainText()`, which walks a detached DOM node (safe: never attached to the document, only `.textContent` is read back) turning `<p>`/`<li>`/`<br>` into newlines before stripping tags. Applied in `VisitorInfoPanel/index.tsx`'s `resolveCannedBody` (the only call site that inserts a canned response into the live composer via `onInsertCanned`/`onSessionInputChange`) and in `CannedResponsesClient/CannedResponseListItem.tsx`'s admin list preview (so the snippet reads as clean text instead of showing raw tags). Net effect: operators still author with a rich editor, but what actually gets sent to a visitor is the same kind of plain-text message as always — no new render-side HTML surface, no render-side sanitizer needed on either frontend.

**Sequencing:** Ship the toolbar restriction (F1), write-side sanitization, and the plain-text composer conversion together — an editor producing HTML that isn't sanitized on write, or that leaks raw tags into a sent message, is a real risk either way.

**Verification:** Create a canned response with bold/list formatting, confirm the rich editor round-trips it correctly on re-edit. Insert it into a live chat via the quick-insert panel — confirm the composer shows clean plain text (line breaks preserved, no visible tags) and the message the visitor receives is the same plain text as any other message. Security check: attempt to save `<script>`/`onerror=` payloads in the editor and confirm the backend strips them before storage (inspect the stored `body` directly, e.g. via Prisma Studio or the API response).

---

## Stream G — Message Bubble Styling (Item 5) — blocked on design input

This item can't be implemented from "needs fixing" alone — it requires concrete direction (screenshots of the current issue, or specifics: spacing, colors, avatar placement, timestamp position, mobile/dark-mode contrast, etc.) from the client before touching code, to avoid inventing an unwanted redesign.

- CMS side: `Enterprise_CMS/src/components/features/chat/ChatConversation/ChatBubble.tsx` (~lines 27-78, Tailwind), `MessagesPane.tsx`.
- Website side: `Enterprise-georgia-NFront/src/components/chat/ChatMessages.tsx` (~lines 44-91) + `ChatMessages.module.scss`.
- Minor cleanup to fold in once direction is provided: the website's `renderMessageBody` (~lines 44-64) sets bubble text color via inline `style` in addition to the SCSS classes — consolidate into SCSS to avoid colors defined in two places.

**Action item:** ask the client for screenshots or specifics before scheduling this stream.

---

## Overall Sequencing

1. **A, B, C, F** — independent of each other and of D/E; can proceed in parallel.
2. **D + E** — same file/function on the backend, do together; D1 (backend, backward-compatible) before or alongside D2 (CMS).
3. **G** — blocked until the client provides visual direction.

## Verification Summary

- Streams A/B/C: manual multi-session/multi-tab testing (two operator logins, widget in a real browser tab close).
- Stream D: backend unit tests for the timezone helper + a direct repro of the client's reported case (08:55 Tbilisi → correct export).
- Stream E: search-field regression test.
- Stream F: functional + basic XSS-payload security check.
- Stream G: visual review once direction is provided.
