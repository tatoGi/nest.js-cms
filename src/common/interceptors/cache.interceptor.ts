// src/common/interceptors/cache.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  mixin,
  Type,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

abstract class BaseCacheInterceptor implements NestInterceptor {
  protected abstract namespace: string;
  protected readonly CACHE_TTL = 300_000; // 5 minutes

  private cache = new Map<string, { data: any; timestamp: number }>();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (method !== 'GET') {
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        this.cache.clear();
      }
      return next.handle();
    }

    const language = request.headers['accept-language']?.toString() || 'default';
    const cacheKey = this.buildKey(request.url, request.query, language);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return of(cached.data);
      }
      this.cache.delete(cacheKey);
    }

    return next.handle().pipe(
      tap((response) => {
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      }),
    );
  }

  private buildKey(url: string, query: Record<string, any>, language: string): string {
    const qs = Object.keys(query || {})
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    return `${this.namespace}:${language}:${url}${qs ? `?${qs}` : ''}`;
  }
}

export function CacheInterceptor(namespace: string): Type<BaseCacheInterceptor> {
  @Injectable()
  class MixinCacheInterceptor extends BaseCacheInterceptor {
    protected namespace = namespace;
  }
  return mixin(MixinCacheInterceptor);
}
