// src/modules/site/dto/site-media.dto.ts

export class SiteMediaDto {
  id!: number;
  url!: string;
  mimeType!: string;
  originalName!: string;
  size!: number;
  width!: number | null;
  height!: number | null;
  alt!: string | null;
  caption!: string | null;
}
