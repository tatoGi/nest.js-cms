// // ─────────────────────────────────────────────────────────────
// // File: src/modules/settings/api/controllers/public-settings.controller.ts
// // ─────────────────────────────────────────────────────────────

// import {
//   Controller,
//   Get,
//   Query,
//   Headers,
//   HttpCode,
//   HttpStatus,
// } from '@nestjs/common';

// import {
//   ApiTags,
//   ApiOperation,
//   ApiOkResponse,
//   ApiHeader,
//   ApiQuery,
// } from '@nestjs/swagger';

// import { Public } from '@/common/decorators/public.decorator';
// import { SettingsService } from '../../application/settings.service';
// import { SettingsPublicResponseDto } from '../../dto';

// @ApiTags('Public Site')
// @Public()
// @Controller('site/settings')
// export class PublicSettingsController {
//   constructor(private readonly settingsService: SettingsService) {}

//   // ==================================================
//   // GET PUBLIC SETTINGS — Flattened key → value map
//   // ==================================================

//   @Get()
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary: 'Get public settings',
//     description:
//       'Returns all public, active settings as a flattened key→value map. ' +
//       'Translatable settings resolve to the requested language. ' +
//       'Non-translatable settings return their global value.',
//   })
//   @ApiHeader({
//     name: 'Accept-Language',
//     required: false,
//     description: 'Language ID (number). Defaults to 1.',
//     example: '1',
//   })
//   @ApiQuery({
//     name: 'languageId',
//     required: false,
//     type: Number,
//     description: 'Language ID override (takes precedence over header)',
//   })
//   @ApiOkResponse({
//     type: SettingsPublicResponseDto,
//     description: 'Flattened settings map',
//   })
//   async getPublicSettings(
//     @Headers('Accept-Language') languageHeader?: string,
//     @Query('languageId') languageIdQuery?: string,
//   ): Promise<SettingsPublicResponseDto> {
//     const languageId = this.resolveLanguageId(languageHeader, languageIdQuery);
//     return this.settingsService.getPublicSettings(languageId);
//   }

//   // ==================================================
//   // PRIVATE
//   // ==================================================

//   private resolveLanguageId(header?: string, queryParam?: string): number {
//     if (queryParam) {
//       const parsed = parseInt(queryParam, 10);
//       if (!isNaN(parsed) && parsed > 0) return parsed;
//     }
//     if (header) {
//       const parsed = parseInt(header, 10);
//       if (!isNaN(parsed) && parsed > 0) return parsed;
//     }
//     return 1;
//   }
// }
