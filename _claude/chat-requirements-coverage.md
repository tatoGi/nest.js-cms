# Requirements coverage matrix — spec vs. plan docs

Cross-check of every line in the original Georgian requirements doc against the
four plan docs written so far (`chat-auto-assign-plan.md`,
`chat-reporting-plan.md`, `chat-supervisor-ui-plan.md`,
`chat-dashboard-ui-plan.md`). Goal: make sure nothing was silently dropped.

## ✅ Covered by an existing plan doc

| Requirement                                                                                                                                         | Covered in                                                | Notes                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| ოპერატორის დატვირთვის ლიმიტი (max 3 active)                                                                                                         | `chat-auto-assign-plan.md`                                | Full plan + tasks                                           |
| მოლოდინის რიგში გადასვლა ლიმიტის მიღწევისას                                                                                                         | `chat-auto-assign-plan.md`                                | `drainQueue()` / queued session design                      |
| ჩატის დასრულების ფორმა — კომენტარი, რეგიონი, პროგრამა                                                                                               | `chat-reporting-plan.md`                                  | `closureSummary` (exists) + new `region`/`programId` fields |
| ანგარიშგება — ყველა 7 ქვეპუნქტი (ოპერატორის ჩატები, პასუხის დრო, ხანგრძლივობა, completed/abandoned, საშ. შეფასება, workload, region/program report) | `chat-reporting-plan.md`                                  | Full plan + tasks                                           |
| ადმინის პროგრამების მართვა (დამატება)                                                                                                               | `chat-reporting-plan.md`                                  | `Program` model + CRUD                                      |
| Dashboard — online ოპერატორები, აქტიური ჩატები, რიგი, დღიური სტატისტიკა, საშ. შეფასება                                                              | `chat-dashboard-ui-plan.md` + `chat-reporting-plan.md` §4 | Full plan + tasks                                           |
| სუპერვაიზორის ოპერატორის მინიჭება/შეცვლა ჩატზე                                                                                                      | `chat-supervisor-ui-plan.md`                              | Already implemented in code; doc confirms it                |
| სუპერვაიზორმა ყველა ჩატი უნდა ნახოს                                                                                                                 | `chat-supervisor-ui-plan.md`                              | Gap found (toggle not permission-gated) + fix planned       |

## ⚠️ Mentioned only as an "open question," not actually planned

| Requirement                                                        | Where mentioned                           | Gap                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ოპერატორის სტატუსები Online/**Away**/**Busy**/Offline რეალურ დროში | `chat-auto-assign-plan.md` open-questions | Only binary online/offline exists in code; Away/Busy called out as "not in this pass" — **no concrete design** (no enum, no persistence, no broadcast events, no UI). Needs its own plan doc. |
| ლიმიტის მიღწევისას სტატუსი შეიცვალოს **Busy**-ზე                   | same                                      | Depends on the status-states plan above — currently the auto-assign plan only stops routing to a full operator, it never flips their visible status.                                          |

## ❌ Not covered anywhere — real gaps

| Requirement (Georgian)                                                                   | What's missing                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ოპერატორის იდენტიფიკაცია** — მხოლოდ სახელი ჩანდეს, პერსონალური ინფო არა                | _Actually already satisfied in code_ — `OPERATOR_SELECT` (`chat.service.ts:20-24`) only exposes `{id, name, avatarMediaId}` to the visitor-facing session payload, no email/phone. Not a gap, but no doc explicitly confirms/tests this — worth a one-line verification task rather than a full plan. |
| **მოლოდინის შეტყობინებები** (automatic "please wait" messages while queued)              | No plan. Ties to the queue in `chat-auto-assign-plan.md` but that doc only handles _assignment_, not visitor-facing messaging while waiting.                                                                                                                                                          |
| **საკონტაქტო ფორმა + შენახვა/გაგზავნა info@gedc.ge-ზე**                                  | No plan. No mail module exists in the backend at all (confirmed in the original gap-analysis) — nothing designs it.                                                                                                                                                                                   |
| **ავტომატური მისალმება** ("გამარჯობა, რით შემიძლია დაგეხმაროთ?")                         | No plan. Not mentioned in any of the 4 docs.                                                                                                                                                                                                                                                          |
| **უმოქმედობის გაფრთხილება + ავტომატური დახურვა**                                         | No plan. `chat-reporting-plan.md` mentions "abandoned" classification depends on this but explicitly defers designing the timer/job itself as an open question — never picked up in a dedicated doc.                                                                                                  |
| **ვიზიტორის ისტორიის წაშლა დახურვის შემდეგ** (return visitor should NOT see old history) | No plan at all, and current code does the **opposite on purpose** (`getVisitorHistory` deliberately returns the last 3 closed sessions). This is a direct contradiction between spec and implementation that none of the 4 docs address or even flag for a decision.                                  |
| **მზა შეტყობინებები — კატეგორიები + რედაქტირება/წაშლა ადმინისთვის**                      | No plan. Existing `CannedResponse` CRUD only has create/delete (no update endpoint, no category field) — not mentioned in any of the 4 docs.                                                                                                                                                          |
| **არასამუშაო საათებში email შეტყობინება**                                                | No plan — same missing-mail-module gap as the contact form item.                                                                                                                                                                                                                                      |

## Why these were missed

The four docs were written incrementally, each scoped to a specific follow-up
question in conversation (auto-assign → reporting → supervisor UI → dashboard).
None of them was a full pass over the _entire_ original spec, so items outside
those four specific threads (messaging/email, status states, history retention,
canned-response categories) never got their own doc.

## Recommended next plan docs (not yet written)

1. **`chat-operator-status-plan.md`** — Online/Away/Busy/Offline as a real
   persisted+broadcast state, including auto-Busy at the 3-chat cap.
2. **`chat-messaging-email-plan.md`** — auto-greeting, waiting messages, contact
   form + `info@gedc.ge` delivery, off-hours email notification, and the
   inactivity-warning + auto-close timer. These all share the same missing
   piece (a mail-sending module) so bundling them in one doc makes sense.
3. **`chat-history-retention-plan.md`** — a decision doc first (spec says delete
   history on close; code currently does the opposite deliberately) before
   writing an implementation plan, since this needs a product call, not just
   an engineering one.
4. **`chat-canned-responses-plan.md`** — add `category` field + `PATCH` update
   endpoint to `CannedResponse`, plus category-grouped UI in the CMS.

## Tasks

- [ ] Write `chat-operator-status-plan.md`
- [ ] Write `chat-messaging-email-plan.md`
- [ ] Write `chat-history-retention-plan.md` (flag the spec/code contradiction for a decision first)
- [ ] Write `chat-canned-responses-plan.md`
- [ ] Add a one-line verification task to `chat-supervisor-ui-plan.md` (or here) confirming operator PII is never sent to visitors — already true in code, just needs a test, not a design
