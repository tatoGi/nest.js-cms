// Single source of truth for the system-triggered CannedResponse rows the
// gateway sends automatically (as opposed to operator-picked templates).
// Defaults here match what used to be hardcoded directly in chat.gateway.ts
// — kept as fallbacks so the feature works even before a supervisor has
// edited/created the corresponding row via the automatic-messages endpoint.
export type AutoMessageTrigger =
  | 'greeting'
  | 'queue_wait'
  | 'queue_contact_offer'
  | 'queue_close_confirm'
  | 'queue_abandon_warning'
  | 'queue_abandon_close'
  | 'inactivity_warning'
  | 'inactivity_close'
  | 'close_confirm'
  | 'session_ended'
  | 'intro_form'
  | 'rating_form'
  | 'contact_info_form';

export const AUTO_MESSAGE_TRIGGERS: AutoMessageTrigger[] = [
  'greeting',
  'queue_wait',
  'queue_contact_offer',
  'queue_close_confirm',
  'queue_abandon_warning',
  'queue_abandon_close',
  'inactivity_warning',
  'inactivity_close',
  'close_confirm',
  'session_ended',
  'intro_form',
  'rating_form',
  'contact_info_form',
];

// The set of editable strings on the visitor widget's intro (registration)
// form — the only trigger that uses `fields` instead of header/body/
// buttonText, since it has more than 3 distinct texts. Shared key set
// between the default-language values (CannedResponse.fields) and each
// language's override (CannedResponseTranslation.fields).
export const INTRO_FORM_FIELD_KEYS = [
  'widgetTitle',
  'nameLabel',
  'phoneLabel',
  'emailLabel',
  'nameRequired',
  'phoneRequired',
  'emailRequired',
  'phoneInvalid',
  'emailInvalid',
  'startButton',
] as const;
export type IntroFormFieldKey = (typeof INTRO_FORM_FIELD_KEYS)[number];

// Which of the visitor-facing inputs on the intro form can be toggled
// required/optional by a supervisor (email_label etc. are just text — these
// are the actual form fields the visitor fills in).
export const INTRO_FORM_REQUIRABLE_FIELDS = ['name', 'phone', 'email'] as const;
export type IntroFormRequirableField = (typeof INTRO_FORM_REQUIRABLE_FIELDS)[number];

// The post-chat star-rating widget's editable strings — its own dedicated
// trigger/row (own fields-based edit form), independent of close_confirm's
// header/body/buttonText (the "End this chat?" question and Cancel label,
// which remain close_confirm's job — only the rating widget itself moved
// here, including what used to be close_confirm's `body`/rate-prompt).
export const RATING_FORM_FIELD_KEYS = [
  'ratePrompt',
  'thanksMessage',
  'commentLabel',
  'commentPlaceholder',
  'submitButton',
] as const;
export type RatingFormFieldKey = (typeof RATING_FORM_FIELD_KEYS)[number];

// The "leave your contact info" widget's editable strings — shown for 3
// different triggers (queue_wait/queue_contact_offer/queue_close_confirm),
// each of which keeps its own body text for the message *around* the form,
// but all 3 render the exact same form, so its fields live here once instead
// of being duplicated 3x.
export const CONTACT_INFO_FORM_FIELD_KEYS = [
  'nameLabel',
  'phoneLabel',
  'emailLabel',
  'commentLabel',
  'namePlaceholder',
  'phonePlaceholder',
  'emailPlaceholder',
  'commentPlaceholder',
  'nameRequired',
  'phoneRequired',
  'emailRequired',
  'phoneInvalid',
  'emailInvalid',
  'submitButton',
] as const;
export type ContactInfoFormFieldKey = (typeof CONTACT_INFO_FORM_FIELD_KEYS)[number];

// Which of the contact-info form's real inputs can be toggled required/
// optional by a supervisor — same value set as INTRO_FORM_REQUIRABLE_FIELDS,
// kept as its own const for clarity at the call site.
export const CONTACT_INFO_FORM_REQUIRABLE_FIELDS = ['name', 'phone', 'email'] as const;
export type ContactInfoFormRequirableField = (typeof CONTACT_INFO_FORM_REQUIRABLE_FIELDS)[number];

// inactivity_warning/inactivity_close/queue_contact_offer/queue_wait all
// support a supervisor-configurable delay (queue_wait defaults to 0 —
// effectively immediate — but can be pushed back); greeting fires immediately
// with no delay concept at all.
// close_confirm and session_ended aren't sent as chat messages at all —
// they're rendered directly by the visitor widget's own UI (the pre-close
// popup and the post-close "ended" screen, respectively; see
// chat.gateway.ts's visitor:start/visitor:rejoin and the 3 close paths).
// They're the only triggers that use `header` (mandatory) alongside `body`
// (optional, no delay concept) and `buttonText` (optional — the label of
// their single action button).
export const AUTO_MESSAGE_DEFAULTS: Record<
  AutoMessageTrigger,
  {
    title: string;
    header?: string;
    body: string;
    buttonText?: string;
    // intro_form / rating_form / contact_info_form — see their respective
    // *_FIELD_KEYS above. Every other trigger leaves this unset.
    fields?:
      | Record<IntroFormFieldKey, string>
      | Record<RatingFormFieldKey, string>
      | Record<ContactInfoFormFieldKey, string>;
    // Only meaningful for intro_form/contact_info_form — see
    // INTRO_FORM_REQUIRABLE_FIELDS/CONTACT_INFO_FORM_REQUIRABLE_FIELDS.
    requiredFields?: IntroFormRequirableField[] | ContactInfoFormRequirableField[];
    delaySeconds: number | null;
    isEnabled: boolean;
  }
> = {
  greeting: {
    title: 'Auto-Greeting',
    body: "Thanks for reaching out! We'll be with you shortly.",
    delaySeconds: null,
    isEnabled: true,
  },
  // Fires while queued (no operator yet) during business hours, after this
  // delay — shows the visitor a contact-info form with the option to keep
  // waiting instead. queue_contact_offer is this trigger's off-hours
  // counterpart: the two never fire for the same session (see
  // isBusinessHours()/onlineOperators gating in chat.gateway.ts).
  queue_wait: {
    title: 'Queue Waiting Message',
    body: "All our operators are currently busy — you're in the queue and will be connected as soon as one is free. You can keep waiting or leave your contact info instead.",
    delaySeconds: 5 * 60,
    isEnabled: true,
  },
  // Fires immediately (no delay) while queued outside business hours, or
  // when zero operators are online at all — shows the same contact-info
  // form as queue_wait, but with no "keep waiting" option since there's no
  // one to wait for.
  queue_contact_offer: {
    title: 'Non-Working Hours Automatic Message',
    body: 'Please contact us during business hours 09:00-18:00, or leave a message and we’ll get back to you.',
    delaySeconds: null,
    isEnabled: true,
  },
  // Shown when the visitor clicks the widget's close (X) button while still
  // queued (no operator yet) — same contact-info form as queue_wait/
  // queue_contact_offer, but reachable any time the visitor is queued, not
  // just after a delay. Resolved and pushed to the visitor's own socket at
  // session start/rejoin (see emitQueueCloseConfirmMessage), same pattern as
  // close_confirm/session_ended below.
  queue_close_confirm: {
    title: 'Queue Close Confirmation',
    body: 'Leave the queue? You can leave your contact info instead, or cancel and keep waiting.',
    delaySeconds: null,
    isEnabled: true,
  },
  // Fires after this delay if the visitor is still queued and unassigned —
  // whether that's because it's outside business hours (queue_contact_offer
  // already shown, immediately) or because every operator is busy during
  // business hours (queue_wait already shown, at its own 5 min delay).
  // Without an operator ever joining, nothing else in the system would
  // otherwise warn the visitor or ever close this session — see
  // queue_abandon_close below. Delay is measured from when the session first
  // became queued-and-unassigned (armed alongside queue_wait/
  // queue_contact_offer), not from either of those firing.
  //
  // Default is deliberately more generous than inactivity_warning's 5 min:
  // during business hours this is the ONLY thing standing between "every
  // operator is briefly busy" and losing a visitor who'd have gladly waited
  // — a short default here would make being simply understaffed for a few
  // minutes as costly as being unreachable outside business hours entirely.
  queue_abandon_warning: {
    title: 'Queue Abandon Warning',
    body: 'Are you still there? This chat will close soon if we don’t hear from you.',
    delaySeconds: 10 * 60,
    isEnabled: true,
  },
  // Closes the session this delay after queue_abandon_warning, if the
  // visitor still hasn't sent a message, left contact info, or been
  // assigned an operator. Two-stage warn-then-close, same shape as
  // inactivity_warning/inactivity_close — just triggered by the visitor
  // never having started a conversation at all, rather than one going idle.
  queue_abandon_close: {
    title: 'Queue Abandon Auto-Close',
    body: 'This chat has been closed automatically — no response was received.',
    delaySeconds: 5 * 60,
    isEnabled: true,
  },
  inactivity_warning: {
    title: 'Inactivity Warning',
    body: 'We’d like to inform you that no activity has been detected for a while. If you still need assistance, please continue the conversation. If inactivity continues, the chat will be closed automatically.',
    delaySeconds: 5 * 60,
    isEnabled: true,
  },
  inactivity_close: {
    title: 'Inactivity Auto-Close',
    body: 'This chat has been closed automatically due to inactivity.',
    delaySeconds: 5 * 60,
    isEnabled: true,
  },
  // body is now unused (rating_form.fields.ratePrompt replaced it as the
  // rating widget's own prompt) — kept editable for backward compat with any
  // already-customized row, just no longer read anywhere.
  close_confirm: {
    title: 'Close Confirmation',
    header: "End this chat? You'll need to start a new conversation.",
    body: 'How was your chat?',
    buttonText: 'Cancel',
    delaySeconds: null,
    isEnabled: true,
  },
  session_ended: {
    title: 'Chat Ended Screen',
    header: 'Chat ended',
    body: 'Thank you. An operator will contact you shortly.',
    buttonText: 'Start New Chat',
    delaySeconds: null,
    isEnabled: true,
  },
  intro_form: {
    title: 'Intro Form',
    // body is unused for this trigger (kept empty — this trigger's editable
    // text all lives in `fields` instead).
    body: '',
    fields: {
      widgetTitle: 'Online Consultation',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      emailLabel: 'Email (optional)',
      nameRequired: 'Name is required',
      phoneRequired: 'Phone is required',
      emailRequired: 'Email is required',
      phoneInvalid: 'Enter a valid phone number',
      emailInvalid: 'Enter a valid email address',
      startButton: 'Start chat',
    },
    requiredFields: ['name', 'phone'],
    delaySeconds: null,
    isEnabled: true,
  },
  rating_form: {
    title: 'Rating Form',
    body: '',
    fields: {
      ratePrompt: 'How was your chat?',
      thanksMessage: 'Thanks for your feedback!',
      commentLabel: 'Comment',
      commentPlaceholder: 'Add a comment (optional)',
      submitButton: 'Submit',
    },
    delaySeconds: null,
    isEnabled: true,
  },
  contact_info_form: {
    title: 'Contact Info Form',
    body: '',
    fields: {
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      emailLabel: 'Email (optional)',
      commentLabel: 'Additional message (optional)',
      namePlaceholder: 'Enter your name',
      phonePlaceholder: '+1',
      emailPlaceholder: 'e.g. user@mail.com',
      commentPlaceholder: 'Additional message (optional)',
      nameRequired: 'Name is required',
      phoneRequired: 'Phone is required',
      emailRequired: 'Email is required',
      phoneInvalid: 'Enter a valid phone number',
      emailInvalid: 'Enter a valid email address',
      submitButton: 'Submit',
    },
    requiredFields: ['name', 'phone'],
    delaySeconds: null,
    isEnabled: true,
  },
};
