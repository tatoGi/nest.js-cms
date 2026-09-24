import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequirePermissions } from '@/common/guards/permissions.guard';
import { Public } from '@/common/decorators/public.decorator';
import { ExcelStreamWriter } from '@/common/excel/excel-stream-writer';
import { ChatService, ChatCloseReason } from '../application/chat.service';
import {
  CHAT_HISTORY_EXPORT_COLUMNS,
  CONTACT_REQUESTS_EXPORT_COLUMNS,
  toChatHistoryExportRecord,
  toContactRequestExportRecord,
  isContactRequestRow,
} from '../application/chat-history-export';
import { DmService } from '../application/dm.service';
import { ProgramsService } from '../application/programs.service';
import { RegionsService } from '../application/regions.service';
import { CannedResponseService } from '../application/canned-response.service';
import { ChatReportingService } from '../application/chat-reporting.service';
import { ChatGateway } from '../chat.gateway';
import {
  StartSessionDto,
  CloseSessionWithResolutionDto,
  AssignSessionDto,
  RateSessionDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
  UpdateAutoMessageDto,
  UpdateChatConfigDto,
  CreateProgramDto,
  UpdateProgramDto,
  CreateRegionDto,
  UpdateRegionDto,
  CreateCannedResponseCategoryDto,
  UpdateCannedResponseCategoryDto,
  UpdateSessionDetailsDto,
  BulkTrashSessionsDto,
} from '../dto/chat.dto';
import {
  AUTO_MESSAGE_TRIGGERS,
  type AutoMessageTrigger,
} from '../application/auto-message.constants';
import { Request } from 'express';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly dmService: DmService,
    private readonly programsService: ProgramsService,
    private readonly regionsService: RegionsService,
    private readonly cannedResponseService: CannedResponseService,
    private readonly chatReportingService: ChatReportingService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // Caps user-controlled `take` query params so a client can't request an
  // unbounded page size (e.g. ?take=999999) and defeat pagination entirely.
  private parseTake(take: string | undefined, def: number, max = 50): number {
    if (!take) return def;
    const n = +take;
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
  }

  // Shared parsing for the two comma-separated-query-string list shapes
  // multiselect filters arrive as (e.g. operatorIds=3,7) — kept as two tiny
  // single-purpose helpers rather than one parameterized one, since the
  // number/string cases have different validity checks.
  private parseNumberList(value: string | undefined): number[] | undefined {
    return value
      ? value
          .split(',')
          .map(Number)
          .filter((n) => Number.isFinite(n))
      : undefined;
  }

  private parseStringList(value: string | undefined): string[] | undefined {
    return value ? value.split(',') : undefined;
  }

  private parseBooleanList(value: string | undefined): boolean[] | undefined {
    return value ? value.split(',').map((v) => v === 'true') : undefined;
  }

  // Single source of truth for the Chat History table's filter shape —
  // shared by getChatHistory (paginated JSON) and exportChatHistory (xlsx
  // stream) so the two can never drift apart on how a query param is
  // interpreted (the bug that let an unrelated session leak into a
  // contactRequestEmailSent-filtered result was exactly this kind of
  // duplication going out of sync).
  private parseChatHistoryFilters(query: {
    operatorIds?: string;
    languages?: string;
    resolutionTags?: string;
    ratings?: string;
    contactRequestEmailSent?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return {
      operatorIds: this.parseNumberList(query.operatorIds),
      languages: this.parseStringList(query.languages),
      resolutionTags: this.parseStringList(query.resolutionTags),
      ratings: this.parseNumberList(query.ratings),
      contactRequestEmailSent: this.parseBooleanList(query.contactRequestEmailSent),
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
  }

  // ── Visitor (public) ────────────────────────────────────────────

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('sessions')
  startSession(@Body() dto: StartSessionDto) {
    return this.chatService.startSession(dto);
  }

  // Not @Public() — the visitor widget never calls this (it gets messages
  // over the socket via visitor:rejoin/SESSION_REJOINED, which filters
  // internal notes itself, see chat.gateway.ts). This endpoint is only ever
  // used by the CMS's chat-history pagination (useChatHistoryDetail), which
  // is always operator-authenticated — so it's gated the same as every
  // other operator session route and may safely include internal notes.
  @RequirePermissions('chat.view')
  @Get('sessions/:id/messages')
  getMessages(@Param('id') id: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.chatService.getSessionMessages(id, true, skip ? +skip : 0, take ? +take : 10);
  }

  @Public()
  @Patch('sessions/:id/rate')
  rateSession(@Param('id') id: string, @Body() dto: RateSessionDto) {
    return this.chatService.rateSession(id, dto.rating);
  }

  // The widget shows the intro (registration) form before starting a
  // session — there's no session room to emit into yet, so this is a plain
  // REST read (served from the gateway's in-memory cache) instead of a
  // socket event like close_confirm/session_ended use.
  @Public()
  @Get('intro-form-text')
  getIntroFormText(@Query('lang') lang?: string) {
    const msg = this.chatGateway.getAutoMessage('intro_form', lang);
    return {
      fields: msg.fields ?? {},
      requiredFields: msg.requiredFields ?? [],
      isEnabled: msg.isEnabled,
    };
  }

  // Same reasoning as intro-form-text — the "leave your contact info"
  // widget (queue_wait/queue_contact_offer/queue_close_confirm all render
  // it) has no session-independent trigger point of its own to piggyback a
  // socket emit on, so it's a plain cacheable REST read too.
  @Public()
  @Get('contact-info-form-text')
  getContactInfoFormText(@Query('lang') lang?: string) {
    const msg = this.chatGateway.getAutoMessage('contact_info_form', lang);
    return { fields: msg.fields ?? {}, requiredFields: msg.requiredFields ?? [] };
  }

  // Public, unauthenticated — the visitor widget's own notification sound
  // settings (separate from the operator-side ones under chat.manage_config
  // below). Cheap to call on widget mount, same pattern as intro-form-text.
  @Public()
  @Get('visitor-notification-config')
  getVisitorNotificationConfig() {
    return this.chatService.getVisitorNotificationConfig();
  }

  // ── Operator ────────────────────────────────────────────────────

  @RequirePermissions('chat.view')
  @Get('sessions')
  getOpenSessions(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.chatService.getOpenSessions(skip ? +skip : 0, take ? +take : 20);
  }

  @RequirePermissions('chat.view')
  @Get('sessions/closed')
  getClosedSessions(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('mine') mine?: string,
    @Req() req?: Request,
  ) {
    const operatorId = mine === 'true' ? (req!.user as { userId: number }).userId : undefined;
    return this.chatService.getClosedSessions(skip ? +skip : 0, take ? +take : 20, operatorId);
  }

  // Backs the CMS's Chat History table — server-side filtered/paginated,
  // distinct from the lighter getClosedSessions above. Multiselect filters
  // arrive as comma-separated query strings (e.g. operatorIds=3,7).
  @RequirePermissions('chat.view')
  @Get('sessions/history')
  getChatHistory(
    @Query('page') page?: string,
    @Query('operatorIds') operatorIds?: string,
    @Query('languages') languages?: string,
    @Query('resolutionTags') resolutionTags?: string,
    @Query('ratings') ratings?: string,
    @Query('contactRequestEmailSent') contactRequestEmailSent?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.chatService.getChatHistory({
      page: page ? +page : 1,
      ...this.parseChatHistoryFilters({
        operatorIds,
        languages,
        resolutionTags,
        ratings,
        contactRequestEmailSent,
        search,
        dateFrom,
        dateTo,
      }),
    });
  }

  // Same filters as sessions/history above, but streamed as an .xlsx
  // instead of paginated JSON — rows are fetched and written in batches
  // (see ChatService.iterateChatHistoryForExport) so this scales to however
  // many sessions match, without buffering the whole file or result set.
  @RequirePermissions('chat.view')
  @Get('sessions/history/export')
  async exportChatHistory(
    @Res() res: Response,
    @Query('operatorIds') operatorIds?: string,
    @Query('languages') languages?: string,
    @Query('resolutionTags') resolutionTags?: string,
    @Query('ratings') ratings?: string,
    @Query('contactRequestEmailSent') contactRequestEmailSent?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=chat-history.xlsx');

    const writer = new ExcelStreamWriter(res);
    const mainSheet = writer.addWorksheet('Chat History', CHAT_HISTORY_EXPORT_COLUMNS);
    const contactRequestsSheet = writer.addWorksheet(
      'Contact Requests',
      CONTACT_REQUESTS_EXPORT_COLUMNS,
    );
    const params = this.parseChatHistoryFilters({
      operatorIds,
      languages,
      resolutionTags,
      ratings,
      contactRequestEmailSent,
      search,
      dateFrom,
      dateTo,
    });
    for await (const batch of this.chatService.iterateChatHistoryForExport(params)) {
      for (const row of batch) {
        mainSheet.addRow(toChatHistoryExportRecord(row));
        if (isContactRequestRow(row)) {
          contactRequestsSheet.addRow(toContactRequestExportRecord(row));
        }
      }
    }
    await writer.end();
  }

  @RequirePermissions('chat.view')
  @Get('visitor-history')
  getVisitorHistory(
    @Query('email') email: string,
    @Query('excludeSession') excludeSession?: string,
  ) {
    return this.chatService.getVisitorHistory(email, excludeSession);
  }

  @RequirePermissions('chat.delete_sessions')
  @Get('sessions/trash')
  getTrashedSessions(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.chatService.getTrashedSessions(skip ? +skip : 0, take ? +take : 20);
  }

  @RequirePermissions('chat.view')
  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @RequirePermissions('chat.delete_sessions')
  @Delete('sessions/:id')
  trashSession(@Param('id') id: string) {
    return this.chatService.trashSession(id);
  }

  // Backs the CMS Chat History table's bulk-select delete — same "must be
  // closed" rule as the single-session trash above.
  @RequirePermissions('chat.delete_sessions')
  @Post('sessions/bulk-delete')
  @HttpCode(HttpStatus.OK)
  bulkTrashSessions(@Body() dto: BulkTrashSessionsDto) {
    return this.chatService.bulkTrashSessions(dto.ids);
  }

  @RequirePermissions('chat.delete_sessions')
  @Patch('sessions/:id/restore')
  restoreSession(@Param('id') id: string) {
    return this.chatService.restoreSession(id);
  }

  // Backs the Trash tab's multi-select restore.
  @RequirePermissions('chat.delete_sessions')
  @Post('sessions/bulk-restore')
  @HttpCode(HttpStatus.OK)
  bulkRestoreSessions(@Body() dto: BulkTrashSessionsDto) {
    return this.chatService.bulkRestoreSessions(dto.ids);
  }

  @RequirePermissions('chat.delete_sessions')
  @Delete('sessions/:id/hard')
  hardDeleteSession(@Param('id') id: string) {
    return this.chatService.hardDeleteSession(id);
  }

  // Backs the Trash tab's multi-select permanent delete.
  @RequirePermissions('chat.delete_sessions')
  @Post('sessions/bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  bulkHardDeleteSessions(@Body() dto: BulkTrashSessionsDto) {
    return this.chatService.bulkHardDeleteSessions(dto.ids);
  }

  @RequirePermissions('chat.close')
  @Post('sessions/:id/close')
  closeSession(
    @Param('id') id: string,
    @Body() dto: CloseSessionWithResolutionDto,
    @Req() req: Request,
  ) {
    const operatorId = (req.user as { userId: number }).userId;
    return this.chatService.closeSessionWithResolution(
      id,
      operatorId,
      ChatCloseReason.OPERATOR_CLOSED,
      dto,
    );
  }

  @RequirePermissions('chat.view')
  @Post('sessions/:id/reopen')
  reopenSession(@Param('id') id: string) {
    return this.chatService.reopenSession(id);
  }

  @RequirePermissions('chat.close')
  @Patch('sessions/:id/assign')
  assignSession(@Param('id') id: string, @Body() dto: AssignSessionDto) {
    return this.chatService.assignOperator(id, dto.operatorId ?? null);
  }

  // Region / program / comment — settable any time during a session (not
  // just at close) from the operator's visitor info panel.
  @RequirePermissions('chat.view')
  @Patch('sessions/:id/details')
  updateSessionDetails(@Param('id') id: string, @Body() dto: UpdateSessionDetailsDto) {
    return this.chatService.updateSessionDetails(id, dto);
  }

  @RequirePermissions('chat.view')
  @Get('operators')
  getOperators(@Req() req: Request) {
    const user = req.user as { userId: number };
    return this.chatService.getOperators(user.userId);
  }

  // ── Reporting / live dashboard (read-only aggregation) ───────────

  @RequirePermissions('chat.manage_analytics')
  @Get('reports/operators')
  getOperatorStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.chatReportingService.getOperatorStats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @RequirePermissions('chat.manage_analytics')
  @Get('reports/outcomes')
  getOutcomeStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.chatReportingService.getOutcomeStats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @RequirePermissions('chat.manage_analytics')
  @Get('reports/regions')
  getRegionProgramReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.chatReportingService.getRegionProgramReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @RequirePermissions('chat.view')
  @Get('dashboard')
  async getDashboard() {
    const [activeChats, waitingQueue, dailyStats] = await Promise.all([
      this.chatService.getOpenSessions(0, 100, true),
      this.chatReportingService.getQueuedSessionsSummary(),
      this.chatReportingService.getDailyStats(),
    ]);

    return {
      onlineOperators: this.chatGateway.getOnlineOperatorIds(),
      activeChats,
      waitingQueue,
      dailyStats,
    };
  }

  // ── Programs (chat reporting taxonomy) ───────────────────────────

  @RequirePermissions('chat.view')
  @Get('programs')
  getPrograms() {
    return this.programsService.getPrograms();
  }

  @RequirePermissions('chat.view')
  @Get('programs/paginated')
  getProgramsPaginated(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.programsService.getProgramsPaginated(skip ? +skip : 0, this.parseTake(take, 5));
  }

  @RequirePermissions('chat.manage_programs')
  @Post('programs')
  createProgram(@Body() dto: CreateProgramDto) {
    return this.programsService.createProgram(dto.name);
  }

  @RequirePermissions('chat.manage_programs')
  @Patch('programs/:id')
  updateProgram(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.programsService.updateProgram(id, dto);
  }

  @RequirePermissions('chat.manage_programs')
  @Get('programs/trash')
  getTrashedPrograms() {
    return this.programsService.getTrashedPrograms();
  }

  @RequirePermissions('chat.manage_programs')
  @Delete('programs/:id')
  trashProgram(@Param('id') id: string) {
    return this.programsService.trashProgram(id);
  }

  @RequirePermissions('chat.manage_programs')
  @Patch('programs/:id/restore')
  restoreProgram(@Param('id') id: string) {
    return this.programsService.restoreProgram(id);
  }

  @RequirePermissions('chat.manage_programs')
  @Post('programs/bulk-restore')
  @HttpCode(HttpStatus.OK)
  bulkRestorePrograms(@Body() dto: BulkTrashSessionsDto) {
    return this.programsService.bulkRestorePrograms(dto.ids);
  }

  @RequirePermissions('chat.manage_programs')
  @Delete('programs/:id/hard')
  deleteProgram(@Param('id') id: string) {
    return this.programsService.deleteProgram(id);
  }

  @RequirePermissions('chat.manage_programs')
  @Post('programs/bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  bulkDeletePrograms(@Body() dto: BulkTrashSessionsDto) {
    return this.programsService.bulkDeletePrograms(dto.ids);
  }

  // ── Regions (chat reporting taxonomy) ─────────────────────────────

  @RequirePermissions('chat.manage_regions')
  @Get('regions/trash')
  getTrashedRegions() {
    return this.regionsService.getTrashedRegions();
  }

  @RequirePermissions('chat.view')
  @Get('regions')
  getRegions() {
    return this.regionsService.getRegions();
  }

  @RequirePermissions('chat.view')
  @Get('regions/paginated')
  getRegionsPaginated(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.regionsService.getRegionsPaginated(skip ? +skip : 0, this.parseTake(take, 5));
  }

  @RequirePermissions('chat.manage_regions')
  @Post('regions')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.regionsService.createRegion(dto.name);
  }

  @RequirePermissions('chat.manage_regions')
  @Patch('regions/:id')
  updateRegion(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionsService.updateRegion(id, dto);
  }

  @RequirePermissions('chat.manage_regions')
  @Delete('regions/:id')
  trashRegion(@Param('id') id: string) {
    return this.regionsService.trashRegion(id);
  }

  @RequirePermissions('chat.manage_regions')
  @Patch('regions/:id/restore')
  restoreRegion(@Param('id') id: string) {
    return this.regionsService.restoreRegion(id);
  }

  @RequirePermissions('chat.manage_regions')
  @Post('regions/bulk-restore')
  @HttpCode(HttpStatus.OK)
  bulkRestoreRegions(@Body() dto: BulkTrashSessionsDto) {
    return this.regionsService.bulkRestoreRegions(dto.ids);
  }

  @RequirePermissions('chat.manage_regions')
  @Delete('regions/:id/hard')
  deleteRegion(@Param('id') id: string) {
    return this.regionsService.deleteRegion(id);
  }

  @RequirePermissions('chat.manage_regions')
  @Post('regions/bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  bulkDeleteRegions(@Body() dto: BulkTrashSessionsDto) {
    return this.regionsService.bulkDeleteRegions(dto.ids);
  }

  // ── Canned Response Categories ────────────────────────────────────
  // Read stays on chat.view (any operator using the composer needs the
  // list); create/update/delete require chat.manage_canned_responses, same
  // as the canned-response CRUD below.

  @RequirePermissions('chat.manage_canned_responses')
  @Get('canned-response-categories/trash')
  getTrashedCannedResponseCategories() {
    return this.cannedResponseService.getTrashedCannedResponseCategories();
  }

  @RequirePermissions('chat.view')
  @Get('canned-response-categories')
  getCannedResponseCategories() {
    return this.cannedResponseService.getCannedResponseCategories();
  }

  @RequirePermissions('chat.view')
  @Get('canned-response-categories/paginated')
  getCannedResponseCategoriesPaginated(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.cannedResponseService.getCannedResponseCategoriesPaginated(
      skip ? +skip : 0,
      this.parseTake(take, 5),
    );
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-response-categories')
  createCannedResponseCategory(@Body() dto: CreateCannedResponseCategoryDto) {
    return this.cannedResponseService.createCannedResponseCategory(dto.name);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Patch('canned-response-categories/:id')
  updateCannedResponseCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseCategoryDto,
  ) {
    return this.cannedResponseService.updateCannedResponseCategory(id, dto);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Delete('canned-response-categories/:id')
  trashCannedResponseCategory(@Param('id') id: string) {
    return this.cannedResponseService.trashCannedResponseCategory(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Patch('canned-response-categories/:id/restore')
  restoreCannedResponseCategory(@Param('id') id: string) {
    return this.cannedResponseService.restoreCannedResponseCategory(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-response-categories/bulk-restore')
  @HttpCode(HttpStatus.OK)
  bulkRestoreCannedResponseCategories(@Body() dto: BulkTrashSessionsDto) {
    return this.cannedResponseService.bulkRestoreCannedResponseCategories(dto.ids);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Delete('canned-response-categories/:id/hard')
  deleteCannedResponseCategory(@Param('id') id: string) {
    return this.cannedResponseService.deleteCannedResponseCategory(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-response-categories/bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  bulkDeleteCannedResponseCategories(@Body() dto: BulkTrashSessionsDto) {
    return this.cannedResponseService.bulkDeleteCannedResponseCategories(dto.ids);
  }

  // ── Canned Responses ────────────────────────────────────────────
  // Read stays on chat.view (any operator uses these in the composer);
  // create/update/delete require chat.manage_canned_responses.

  @RequirePermissions('chat.view')
  @Get('canned-responses/paginated')
  getCannedResponsesPaginated(
    // categoryId: omit entirely for all categories combined, "none" for the
    // "Uncategorized" bucket (categoryId: null), or an actual category id.
    @Query('categoryId') categoryId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const resolvedCategoryId =
      categoryId === undefined ? undefined : categoryId === 'none' ? null : categoryId;
    return this.cannedResponseService.getCannedResponsesPaginated(
      resolvedCategoryId,
      skip ? +skip : 0,
      this.parseTake(take, 5),
    );
  }

  @RequirePermissions('chat.view')
  @Get('canned-responses')
  getCannedResponses() {
    return this.cannedResponseService.getCannedResponses();
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-responses')
  createCannedResponse(@Body() dto: CreateCannedResponseDto, @Req() req: Request) {
    const user = req.user as { userId: number };
    return this.cannedResponseService.createCannedResponse(dto, user.userId);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Patch('canned-responses/:id')
  updateCannedResponse(@Param('id') id: string, @Body() dto: UpdateCannedResponseDto) {
    return this.cannedResponseService.updateCannedResponse(id, dto);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Get('canned-responses/trash')
  getTrashedCannedResponses() {
    return this.cannedResponseService.getTrashedCannedResponses();
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Delete('canned-responses/:id')
  trashCannedResponse(@Param('id') id: string) {
    return this.cannedResponseService.trashCannedResponse(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Patch('canned-responses/:id/restore')
  restoreCannedResponse(@Param('id') id: string) {
    return this.cannedResponseService.restoreCannedResponse(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-responses/bulk-restore')
  @HttpCode(HttpStatus.OK)
  bulkRestoreCannedResponses(@Body() dto: BulkTrashSessionsDto) {
    return this.cannedResponseService.bulkRestoreCannedResponses(dto.ids);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Delete('canned-responses/:id/hard')
  deleteCannedResponse(@Param('id') id: string) {
    return this.cannedResponseService.deleteCannedResponse(id);
  }

  @RequirePermissions('chat.manage_canned_responses')
  @Post('canned-responses/bulk-hard-delete')
  @HttpCode(HttpStatus.OK)
  bulkDeleteCannedResponses(@Body() dto: BulkTrashSessionsDto) {
    return this.cannedResponseService.bulkDeleteCannedResponses(dto.ids);
  }

  // ── Automatic (system-triggered) messages — supervisor only ──────
  // Separate route + permission from the manual canned-response CRUD above:
  // editing these changes live behavior for every visitor, not just an
  // operator's personal template library.

  @RequirePermissions('chat.manage_automation')
  @Get('canned-responses/automatic')
  getAutoMessages() {
    return this.cannedResponseService.getAutoMessages();
  }

  @RequirePermissions('chat.manage_automation')
  @Patch('canned-responses/automatic/:trigger')
  async updateAutoMessage(
    @Param('trigger') trigger: string,
    @Body() dto: UpdateAutoMessageDto,
    @Req() req: Request,
  ) {
    if (!AUTO_MESSAGE_TRIGGERS.includes(trigger as AutoMessageTrigger)) {
      throw new BadRequestException(`Unknown trigger: ${trigger}`);
    }
    const user = req.user as { userId: number };
    const result = await this.cannedResponseService.upsertAutoMessage(
      trigger as AutoMessageTrigger,
      dto,
      user.userId,
    );
    await this.chatGateway.invalidateAutoMessageCache();
    return result;
  }

  // ── Chat config (supervisor-tunable global knobs) ─────────────────
  // The per-operator active-chat cap the gateway enforces on auto-assignment,
  // plus team-wide notification sound/volume/duration — see ChatConfig in
  // schema.prisma. Read is chat.view (every operator's browser needs it to
  // play the shared notification sound), write stays chat.manage_config
  // (supervisor-only).

  @RequirePermissions('chat.view')
  @Get('config')
  getChatConfig() {
    return this.chatService.getChatConfig();
  }

  @RequirePermissions('chat.manage_config')
  @Patch('config')
  async updateChatConfig(@Body() dto: UpdateChatConfigDto) {
    const result = await this.chatService.updateChatConfig(dto);
    await this.chatGateway.invalidateChatConfigCache();
    return result;
  }

  // ── DM threads ──────────────────────────────────────────────────

  @RequirePermissions('chat.view')
  @Get('dm/threads')
  getMyThreads(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.dmService.getThreadsForUser(user.id);
  }

  @RequirePermissions('chat.view')
  @Get('dm/threads/:threadId/messages')
  getThreadMessages(@Param('threadId') threadId: string) {
    return this.dmService.getThreadMessages(threadId);
  }
}
