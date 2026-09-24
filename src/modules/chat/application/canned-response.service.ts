import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { sanitizeRichText } from './rich-text.util';
import {
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
  UpdateAutoMessageDto,
  UpdateCannedResponseCategoryDto,
} from '../dto/chat.dto';
import {
  AUTO_MESSAGE_TRIGGERS,
  AUTO_MESSAGE_DEFAULTS,
  type AutoMessageTrigger,
} from './auto-message.constants';

// Canned-response bodies are stored as rich text and can be sent into a
// live chat verbatim (see ChatMessage.isHtml), so every write path goes
// through the shared allowlist in rich-text.util — never trusted from the
// client as-is, since the CMS's restricted toolbar is only a UX guard.
const sanitizeCannedResponseBody = sanitizeRichText;

// Everything backed by the CannedResponse table: operator-picked templates
// (with categories) and system-triggered automatic messages (trigger !=
// null) — both persist into the same table/translations, so they share the
// upsertCannedResponseTranslations helper below and live in one service.
@Injectable()
export class CannedResponseService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly CANNED_RESPONSE_SELECT = {
    id: true,
    title: true,
    body: true,
    categoryId: true,
    category: { select: { id: true, name: true } },
    translations: { include: { language: true } },
  } as const;

  private mapCannedResponseRow<
    T extends { translations: { language: { code: string }; body: string }[] },
  >({ translations: rowTranslations, ...rest }: T) {
    const translations: Record<string, string> = {};
    rowTranslations.forEach((t) => {
      translations[t.language.code] = t.body;
    });
    return { ...rest, translations };
  }

  async getCannedResponses() {
    const rows = await this.prisma.cannedResponse.findMany({
      where: { trigger: null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: CannedResponseService.CANNED_RESPONSE_SELECT,
    });
    return rows.map((row) => this.mapCannedResponseRow(row));
  }

  // Server-paginated variant — used by the CMS's per-category canned-
  // response list once a category can plausibly hold hundreds of entries,
  // where loading everything up front (getCannedResponses above) stops
  // being reasonable. Pass categoryId to scope to one category (null scopes
  // to the "Uncategorized" bucket); omit it entirely to paginate across all
  // categories combined.
  async getCannedResponsesPaginated(categoryId: string | null | undefined, skip = 0, take = 5) {
    const where = {
      trigger: null,
      deletedAt: null,
      ...(categoryId !== undefined ? { categoryId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cannedResponse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: CannedResponseService.CANNED_RESPONSE_SELECT,
      }),
      this.prisma.cannedResponse.count({ where }),
    ]);
    return { items: rows.map((row) => this.mapCannedResponseRow(row)), total };
  }

  // ── Canned Response Categories ──────────────────────────────────
  // Same simple shape/rules as Programs/Regions, except delete cascades onto
  // the responses under a category rather than SetNull — see schema.prisma
  // comment on CannedResponseCategory for the full reasoning.

  async getCannedResponseCategories() {
    return this.prisma.cannedResponseCategory.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getCannedResponseCategoriesPaginated(skip = 0, take = 5) {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cannedResponseCategory.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.cannedResponseCategory.count({ where }),
    ]);
    return { items, total };
  }

  async getTrashedCannedResponseCategories() {
    return this.prisma.cannedResponseCategory.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async createCannedResponseCategory(name: string) {
    return this.prisma.cannedResponseCategory.create({ data: { name } });
  }

  async updateCannedResponseCategory(id: string, dto: UpdateCannedResponseCategoryDto) {
    return this.prisma.cannedResponseCategory.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
    });
  }

  // Trashing a category also trashes every currently-active response under
  // it — an operator browsing by category shouldn't still see responses
  // whose category was just removed. Responses already trashed individually
  // are left alone (the deletedAt: null filter excludes them).
  async trashCannedResponseCategory(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.cannedResponseCategory.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.cannedResponse.updateMany({
        where: { categoryId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return category;
    });
  }

  // Restoring a category unconditionally restores every response under it —
  // including ones that had been trashed individually before the category
  // itself was ever touched (see docs/plan discussion: intentional, not a
  // filtered/tracked cascade).
  async restoreCannedResponseCategory(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.cannedResponseCategory.update({
        where: { id },
        data: { deletedAt: null },
      });
      await tx.cannedResponse.updateMany({
        where: { categoryId: id },
        data: { deletedAt: null },
      });
      return category;
    });
  }

  // DB-level onDelete: Cascade on CannedResponse.category handles permanently
  // deleting every response under this category — nothing extra needed here.
  async deleteCannedResponseCategory(id: string) {
    return this.prisma.cannedResponseCategory.delete({ where: { id } });
  }

  // Same unconditional-cascade rule as the single-item restore above.
  async bulkRestoreCannedResponseCategories(ids: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.cannedResponseCategory.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: null },
      });
      await tx.cannedResponse.updateMany({
        where: { categoryId: { in: ids } },
        data: { deletedAt: null },
      });
      return result;
    });
  }

  async bulkDeleteCannedResponseCategories(ids: string[]) {
    return this.prisma.cannedResponseCategory.deleteMany({ where: { id: { in: ids } } });
  }

  // Returns all 4 system-message slots, merging in defaults for any trigger
  // that has no row yet — so the admin UI always shows 4 editable entries,
  // and the gateway (via getAutoMessageText) always has something to send.
  // translations is keyed by Language.code, covering only active languages
  // other than the visitor's default fallback (the `body` field).
  async getAutoMessages() {
    const rows = await this.prisma.cannedResponse.findMany({
      where: { trigger: { in: AUTO_MESSAGE_TRIGGERS } },
      include: { translations: { include: { language: true } } },
    });
    const byTrigger = new Map(rows.map((r) => [r.trigger as AutoMessageTrigger, r]));

    return AUTO_MESSAGE_TRIGGERS.map((trigger) => {
      const existing = byTrigger.get(trigger);
      const defaults = AUTO_MESSAGE_DEFAULTS[trigger];
      const translations: Record<string, string> = {};
      const headerTranslations: Record<string, string> = {};
      const buttonTextTranslations: Record<string, string> = {};
      const fieldsTranslations: Record<string, Record<string, string>> = {};
      existing?.translations.forEach((t) => {
        translations[t.language.code] = t.body;
        if (t.header) headerTranslations[t.language.code] = t.header;
        if (t.buttonText) buttonTextTranslations[t.language.code] = t.buttonText;
        if (t.fields) fieldsTranslations[t.language.code] = t.fields as Record<string, string>;
      });
      return {
        trigger,
        title: defaults.title,
        header: existing?.header ?? defaults.header ?? null,
        body: existing?.body ?? defaults.body,
        buttonText: existing?.buttonText ?? defaults.buttonText ?? null,
        fields: (existing?.fields as Record<string, string> | null) ?? defaults.fields ?? null,
        requiredFields:
          (existing?.requiredFields as string[] | null) ?? defaults.requiredFields ?? null,
        delaySeconds: existing?.delaySeconds ?? defaults.delaySeconds,
        isEnabled: existing?.isEnabled ?? defaults.isEnabled,
        isCustomized: !!existing,
        translations,
        headerTranslations,
        buttonTextTranslations,
        fieldsTranslations,
      };
    });
  }

  async upsertAutoMessage(
    trigger: AutoMessageTrigger,
    dto: UpdateAutoMessageDto,
    updatedById: number,
  ) {
    const defaults = AUTO_MESSAGE_DEFAULTS[trigger];
    const supportsDelay = defaults.delaySeconds !== null;
    // Only close_confirm treats header as a mandatory second field — the
    // widget falls back to a built-in title when session_ended's header is
    // left blank (see ChatWidget's `sessionEndedMessage?.header || t.session_closed`).
    const requiresHeader = trigger === 'close_confirm';
    if (requiresHeader && !dto.header?.trim()) {
      throw new BadRequestException('Header is required for this trigger.');
    }

    const row = await this.prisma.cannedResponse.upsert({
      where: { trigger },
      update: {
        body: dto.body,
        ...(dto.header !== undefined ? { header: dto.header } : {}),
        ...(dto.buttonText !== undefined ? { buttonText: dto.buttonText } : {}),
        ...(dto.fields !== undefined ? { fields: dto.fields } : {}),
        ...(dto.requiredFields !== undefined ? { requiredFields: dto.requiredFields } : {}),
        ...(supportsDelay && dto.delaySeconds !== undefined
          ? { delaySeconds: dto.delaySeconds }
          : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      },
      create: {
        title: defaults.title,
        body: dto.body,
        header: dto.header ?? defaults.header ?? null,
        buttonText: dto.buttonText ?? defaults.buttonText ?? null,
        fields: dto.fields ?? defaults.fields ?? undefined,
        requiredFields: dto.requiredFields ?? defaults.requiredFields ?? undefined,
        trigger,
        delaySeconds: supportsDelay ? (dto.delaySeconds ?? defaults.delaySeconds) : null,
        isEnabled: dto.isEnabled ?? true,
        createdById: updatedById,
      },
    });

    if (
      dto.translations ||
      dto.headerTranslations ||
      dto.buttonTextTranslations ||
      dto.fieldsTranslations
    ) {
      await this.upsertCannedResponseTranslations(
        row.id,
        dto.translations ?? {},
        dto.headerTranslations,
        dto.buttonTextTranslations,
        dto.fieldsTranslations,
      );
    }

    // Re-read translations so the response reflects what was actually
    // persisted — without this the caller's local state loses every other
    // language it already had as soon as it applies this response (the
    // upsert result above never carries the translations relation).
    const translationRows = await this.prisma.cannedResponseTranslation.findMany({
      where: { cannedResponseId: row.id },
      include: { language: true },
    });
    const translations: Record<string, string> = {};
    const headerTranslations: Record<string, string> = {};
    const buttonTextTranslations: Record<string, string> = {};
    const fieldsTranslations: Record<string, Record<string, string>> = {};
    translationRows.forEach((t) => {
      translations[t.language.code] = t.body;
      if (t.header) headerTranslations[t.language.code] = t.header;
      if (t.buttonText) buttonTextTranslations[t.language.code] = t.buttonText;
      if (t.fields) fieldsTranslations[t.language.code] = t.fields as Record<string, string>;
    });

    return {
      ...row,
      translations,
      headerTranslations,
      buttonTextTranslations,
      fieldsTranslations,
    };
  }

  // Shared by upsertAutoMessage and the regular canned-response CRUD below —
  // both persist into the same CannedResponseTranslation table, keyed by
  // Language.code (e.g. "en"), whether the parent row is a system trigger or
  // a plain operator-facing template. headerTranslations is only ever passed
  // for close_confirm; every other caller omits it and behavior is unchanged.
  private async upsertCannedResponseTranslations(
    cannedResponseId: string,
    translations: Record<string, string>,
    headerTranslations?: Record<string, string>,
    buttonTextTranslations?: Record<string, string>,
    fieldsTranslations?: Record<string, Record<string, string>>,
  ): Promise<void> {
    const codes = new Set([
      ...Object.keys(translations),
      ...Object.keys(headerTranslations ?? {}),
      ...Object.keys(buttonTextTranslations ?? {}),
      ...Object.keys(fieldsTranslations ?? {}),
    ]);
    const languages = codes.size
      ? await this.prisma.language.findMany({ where: { code: { in: Array.from(codes) } } })
      : [];
    const languageIdByCode = new Map(languages.map((l) => [l.code, l.id]));

    for (const code of codes) {
      const languageId = languageIdByCode.get(code);
      if (!languageId) continue; // unknown/inactive-mismatched code — ignore silently
      const body = translations[code];
      const header = headerTranslations?.[code];
      const buttonText = buttonTextTranslations?.[code];
      const fields = fieldsTranslations?.[code];
      await this.prisma.cannedResponseTranslation.upsert({
        where: { cannedResponseId_languageId: { cannedResponseId, languageId } },
        update: {
          ...(body !== undefined ? { body } : {}),
          ...(header !== undefined ? { header } : {}),
          ...(buttonText !== undefined ? { buttonText } : {}),
          ...(fields !== undefined ? { fields } : {}),
        },
        create: {
          cannedResponseId,
          languageId,
          body: body ?? '',
          header,
          buttonText,
          fields,
        },
      });
    }
  }

  // Used by the gateway (via its own cache) — falls back to the hardcoded
  // default if no supervisor has customized this trigger yet.
  async getAutoMessage(trigger: AutoMessageTrigger): Promise<{
    body: string;
    header: string | null;
    buttonText: string | null;
    fields: Record<string, string> | null;
    requiredFields: string[] | null;
    delaySeconds: number | null;
    isEnabled: boolean;
    translations: Record<string, string>;
    headerTranslations: Record<string, string>;
    buttonTextTranslations: Record<string, string>;
    fieldsTranslations: Record<string, Record<string, string>>;
  }> {
    const row = await this.prisma.cannedResponse.findUnique({
      where: { trigger },
      include: { translations: { include: { language: true } } },
    });
    const defaults = AUTO_MESSAGE_DEFAULTS[trigger];
    const translations: Record<string, string> = {};
    const headerTranslations: Record<string, string> = {};
    const buttonTextTranslations: Record<string, string> = {};
    const fieldsTranslations: Record<string, Record<string, string>> = {};
    row?.translations.forEach((t) => {
      translations[t.language.code] = t.body;
      if (t.header) headerTranslations[t.language.code] = t.header;
      if (t.buttonText) buttonTextTranslations[t.language.code] = t.buttonText;
      if (t.fields) fieldsTranslations[t.language.code] = t.fields as Record<string, string>;
    });
    return {
      body: row?.body ?? defaults.body,
      header: row?.header ?? defaults.header ?? null,
      buttonText: row?.buttonText ?? defaults.buttonText ?? null,
      fields: (row?.fields as Record<string, string> | null) ?? defaults.fields ?? null,
      requiredFields: (row?.requiredFields as string[] | null) ?? defaults.requiredFields ?? null,
      delaySeconds: row?.delaySeconds ?? defaults.delaySeconds,
      isEnabled: row?.isEnabled ?? defaults.isEnabled,
      translations,
      headerTranslations,
      buttonTextTranslations,
      fieldsTranslations,
    };
  }

  async createCannedResponse(dto: CreateCannedResponseDto, createdById: number) {
    const body = sanitizeCannedResponseBody(dto.body);
    const translations = dto.translations
      ? Object.fromEntries(
          Object.entries(dto.translations).map(([code, t]) => [
            code,
            sanitizeCannedResponseBody(t),
          ]),
        )
      : undefined;
    const row = await this.prisma.cannedResponse.create({
      data: { title: dto.title, body, categoryId: dto.categoryId, createdById },
    });
    if (translations) {
      await this.upsertCannedResponseTranslations(row.id, translations);
    }
    return { ...row, translations: translations ?? {} };
  }

  async updateCannedResponse(id: string, dto: UpdateCannedResponseDto) {
    const translations = dto.translations
      ? Object.fromEntries(
          Object.entries(dto.translations).map(([code, t]) => [
            code,
            sanitizeCannedResponseBody(t),
          ]),
        )
      : undefined;
    const row = await this.prisma.cannedResponse.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: sanitizeCannedResponseBody(dto.body) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      },
    });
    if (translations) {
      await this.upsertCannedResponseTranslations(id, translations);
    }
    const translationRows = await this.prisma.cannedResponseTranslation.findMany({
      where: { cannedResponseId: id },
      include: { language: true },
    });
    const persistedTranslations: Record<string, string> = {};
    translationRows.forEach((t) => {
      persistedTranslations[t.language.code] = t.body;
    });
    return { ...row, translations: persistedTranslations };
  }

  async getTrashedCannedResponses() {
    return this.prisma.cannedResponse.findMany({
      where: { trigger: null, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  private async assertDeletableCannedResponse(id: string) {
    const row = await this.prisma.cannedResponse.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Canned response not found');
    if (row.trigger !== null) {
      throw new BadRequestException(
        'System-triggered automatic messages cannot be trashed or deleted',
      );
    }
  }

  async trashCannedResponse(id: string) {
    await this.assertDeletableCannedResponse(id);
    return this.prisma.cannedResponse.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreCannedResponse(id: string) {
    return this.prisma.cannedResponse.update({ where: { id }, data: { deletedAt: null } });
  }

  async deleteCannedResponse(id: string) {
    await this.assertDeletableCannedResponse(id);
    return this.prisma.cannedResponse.delete({ where: { id } });
  }

  async bulkRestoreCannedResponses(ids: string[]) {
    return this.prisma.cannedResponse.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
  }

  // Best-effort like the other bulk operations: `trigger: null` excludes
  // system-triggered auto-messages from the delete set instead of throwing,
  // since a single bad row can't abort a batch of updateMany/deleteMany.
  async bulkDeleteCannedResponses(ids: string[]) {
    return this.prisma.cannedResponse.deleteMany({
      where: { id: { in: ids }, trigger: null },
    });
  }
}
