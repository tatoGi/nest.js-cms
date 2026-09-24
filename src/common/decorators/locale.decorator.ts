import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { parseLanguageId } from '@/common/helper/language.helper';

export const Locale = createParamDecorator((_data: unknown, ctx: ExecutionContext): number => {
  const request = ctx.switchToHttp().getRequest();
  const header: string | undefined = request.headers?.['accept-language'];
  const queryParam: number | undefined = request.query?.languageId
    ? Number(request.query.languageId)
    : undefined;
  return parseLanguageId(header, queryParam);
});
