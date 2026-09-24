import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const NOTIFICATION_SOUND_IDS = [
  'chime',
  'bell',
  'alert',
  'marimba',
  'pop',
  'soft',
  'siren',
  'pulse',
  'dingdong',
  'xylophone',
  'buzz',
  'sonar',
  'drip',
  'whatsapp',
  'messenger',
  'linkedin',
  'discord',
  'slack',
  'imessage',
  'telegram',
  'instagram',
  'twitter',
  'snapchat',
  'tiktok',
  'none',
] as const;

export class StartSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  visitorName?: string;

  @IsOptional()
  @IsEmail()
  visitorEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  visitorPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  visitorLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  visitorBrowser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  visitorIp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  visitorPage?: string;
}

export class SendMessageDto {
  @IsString()
  sessionId: string;

  @IsString()
  @MaxLength(5000)
  body: string;
}

// operator:message and operator:internal_note share this exact shape —
// operatorId is validated (present, numeric) but, since chat.gateway.ts's
// WsAuthGuard now populates the real sender from the verified socket
// identity, it is never trusted as the actual author; kept here only so
// existing clients that still send it aren't rejected by
// forbidNonWhitelisted.
export class OperatorSendMessageDto extends SendMessageDto {
  @IsInt()
  operatorId: number;

  // Set only when the operator sent an unedited canned response, whose body
  // is rich text and should keep its formatting in the chat. Never trusted
  // on its own — ChatService.saveMessage re-sanitizes the body against the
  // shared allowlist (rich-text.util) before persisting or broadcasting.
  @IsOptional()
  @IsBoolean()
  isHtml?: boolean;
}

export class DmMessageDto {
  @IsString()
  threadId: string;

  @IsInt()
  authorId: number;

  @IsString()
  @MaxLength(5000)
  body: string;
}

export class CloseSessionDto {
  @IsString()
  sessionId: string;
}

// resolutionTag is never part of this DTO — every close reason is one of
// CHAT_CLOSE_REASONS, always assigned server-side, never client-supplied.
export class CloseSessionWithResolutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closureSummary?: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  programId?: string;

  // Set internally by the gateway when the visitor submits the "leave
  // contact info" form — never client-validated input on this DTO's own
  // endpoint, just a shared shape with closeSessionWithResolution.
  @IsOptional()
  @IsBoolean()
  contactInfoLeft?: boolean;

  @IsOptional()
  @IsString()
  contactRequestName?: string;

  @IsOptional()
  @IsString()
  contactRequestPhone?: string;

  @IsOptional()
  @IsString()
  contactRequestEmail?: string;

  @IsOptional()
  @IsString()
  contactRequestMessage?: string;

  @IsOptional()
  @IsBoolean()
  contactRequestEmailSent?: boolean;
}

// PATCH sessions/:id/details — lets an operator set/change region, program,
// and the internal comment (closureSummary) any time during a session, not
// just when closing it.
export class UpdateSessionDetailsDto {
  @IsOptional()
  @IsString()
  regionId?: string | null;

  @IsOptional()
  @IsString()
  programId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closureSummary?: string;
}

export class AssignSessionDto {
  @IsInt()
  @IsOptional()
  operatorId: number | null;
}

// Sent by the visitor widget when leaving contact info instead of waiting —
// either from the queue_contact_offer prompt (no name/phone/email/message
// overrides, reuses what the intro form already collected) or the
// no-operators-online notice (a fuller form where the visitor may supply/
// correct all four fields).
export class LeaveContactInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class RateSessionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class BulkTrashSessionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}

export class CreateCannedResponseDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Per-language override, keyed by Language.code (e.g. "en"). `body` above
  // remains the fallback for any active language without an entry here.
  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;
}

export class UpdateCannedResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  // Nullable (not just optional) — explicitly clearing a response's category
  // (vs. simply not touching it) needs to be expressible, unlike title/body
  // which are never intentionally unset via update.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;
}

export class UpdateAutoMessageDto {
  @IsString()
  @MaxLength(5000)
  body: string;

  // Only meaningful for close_confirm/session_ended — validated service-side
  // as mandatory for those two triggers, ignored otherwise.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  header?: string;

  // Only meaningful for close_confirm/session_ended — the label of the
  // trigger's single action button. Optional (falls back to the widget's
  // static dictionary text when unset).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  // Only meaningful for intro_form — a {fieldKey: text} map (see
  // INTRO_FORM_FIELD_KEYS), the default-language values.
  @IsOptional()
  @IsObject()
  fields?: Record<string, string>;

  // Only meaningful for intro_form — which visitor inputs ("name"/"phone"/
  // "email") are required before submit. Not per-language.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  // Only meaningful for inactivity_warning/inactivity_close — validated
  // service-side against which triggers actually support a delay.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  delaySeconds?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  // Per-language override, keyed by Language.code (e.g. "en"). `body` above
  // remains the fallback for any active language without an entry here.
  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;

  // Same shape as translations, but for `header` — only meaningful for
  // close_confirm/session_ended.
  @IsOptional()
  @IsObject()
  headerTranslations?: Record<string, string>;

  // Same shape as translations, but for `buttonText` — only meaningful for
  // close_confirm/session_ended.
  @IsOptional()
  @IsObject()
  buttonTextTranslations?: Record<string, string>;

  // Per-language override of `fields`, keyed by Language.code — only
  // meaningful for intro_form. Each value is itself a {fieldKey: text} map.
  @IsOptional()
  @IsObject()
  fieldsTranslations?: Record<string, Record<string, string>>;
}

export class UpdateChatConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxActiveChats?: number;

  @IsOptional()
  @IsIn(NOTIFICATION_SOUND_IDS)
  notificationSound?: (typeof NOTIFICATION_SOUND_IDS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  notificationVolume?: number;

  // Multiplier applied to each sound's base envelope — see ChatConfig comment
  // in schema.prisma.
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  notificationDuration?: number;

  // Multiplier applied to every preset's literal frequencies.
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  notificationPitch?: number;

  // How many times the sound plays back-to-back for a single new message.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  notificationRepeatCount?: number;

  // Same 5 knobs again, for the "a brand-new session arrived" trigger —
  // operator-only, see ChatConfig comment in schema.prisma.
  @IsOptional()
  @IsIn(NOTIFICATION_SOUND_IDS)
  newChatNotificationSound?: (typeof NOTIFICATION_SOUND_IDS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  newChatNotificationVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  newChatNotificationDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  newChatNotificationPitch?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  newChatNotificationRepeatCount?: number;

  // Same 5 knobs, mirrored for the visitor-facing widget — see ChatConfig
  // comment in schema.prisma for why these are kept separate from the
  // operator-side fields above.
  @IsOptional()
  @IsIn(NOTIFICATION_SOUND_IDS)
  visitorNotificationSound?: (typeof NOTIFICATION_SOUND_IDS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  visitorNotificationVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  visitorNotificationDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  visitorNotificationPitch?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  visitorNotificationRepeatCount?: number;

  // Same 5 knobs again, for the visitor's own outgoing message —
  // visitor-only, see ChatConfig comment in schema.prisma.
  @IsOptional()
  @IsIn(NOTIFICATION_SOUND_IDS)
  visitorSentNotificationSound?: (typeof NOTIFICATION_SOUND_IDS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  visitorSentNotificationVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  visitorSentNotificationDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  visitorSentNotificationPitch?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  visitorSentNotificationRepeatCount?: number;

  // Same 5 knobs again, for the operator's own outgoing message — mirrors
  // visitorSentNotification* above, on the operator side.
  @IsOptional()
  @IsIn(NOTIFICATION_SOUND_IDS)
  operatorSentNotificationSound?: (typeof NOTIFICATION_SOUND_IDS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  operatorSentNotificationVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  operatorSentNotificationDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  operatorSentNotificationPitch?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  operatorSentNotificationRepeatCount?: number;
}

// Programs/Regions are internal reporting taxonomy picked by the operator,
// never shown to visitors — no translations needed.
export class CreateProgramDto {
  @IsString()
  @MaxLength(255)
  name: string;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRegionDto {
  @IsString()
  @MaxLength(255)
  name: string;
}

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Canned response categories — same simple shape as Program/Region above.
export class CreateCannedResponseCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;
}

export class UpdateCannedResponseCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
