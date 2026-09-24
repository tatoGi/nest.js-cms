import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaRepository } from '../domain/media.repository';
import { StorageService } from '../infrastructure/storage.service';
import {
  CreateFolderDto,
  RenameFolderDto,
  MoveFolderDto,
  FolderResponseDto,
  FolderBreadcrumbDto,
} from '../dto/folder.dto';

const MAX_DEPTH = 5;

@Injectable()
export class MediaFoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaRepo: MediaRepository,
    private readonly storageService: StorageService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/--+/g, '-');
  }

  /**
   * Walks up the parent chain from a given folder ID and returns
   * an ordered slug array from root → folder (e.g. ['pages', 'hero-images']).
   */
  private async getSlugChain(id: number): Promise<string[]> {
    const chain: string[] = [];
    let currentId: number | null = id;

    while (currentId !== null) {
      const folder: { slug: string; parentId: number | null } | null =
        await this.prisma.mediaFolder.findUnique({
          where: { id: currentId },
          select: { slug: true, parentId: true },
        });
      if (!folder) break;
      chain.unshift(folder.slug);
      currentId = folder.parentId;
    }

    return chain;
  }

  /**
   * Returns the depth of a folder by walking up the parent chain.
   * Throws if depth exceeds MAX_DEPTH.
   */
  private async assertDepth(parentId: number | null | undefined): Promise<void> {
    if (!parentId) return;

    let depth = 1;
    let currentId: number | null = parentId;

    while (currentId !== null) {
      if (depth >= MAX_DEPTH) {
        throw new BadRequestException(`Folder nesting cannot exceed ${MAX_DEPTH} levels`);
      }
      const parent: { parentId: number | null } | null = await this.prisma.mediaFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!parent) break;
      currentId = parent.parentId;
      depth++;
    }
  }

  /**
   * Returns true if `descendantId` is a descendant of `ancestorId`.
   * Used to prevent circular moves.
   */
  private async isDescendant(ancestorId: number, descendantId: number): Promise<boolean> {
    let currentId: number | null = descendantId;

    while (currentId !== null) {
      if (currentId === ancestorId) return true;
      const folder: { parentId: number | null } | null = await this.prisma.mediaFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!folder) break;
      currentId = folder.parentId;
    }
    return false;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(dto: CreateFolderDto): Promise<FolderResponseDto> {
    await this.assertDepth(dto.parentId);

    const slug = this.toSlug(dto.name);

    const existing = await this.prisma.mediaFolder.findFirst({
      where: { slug, parentId: dto.parentId ?? null },
    });
    if (existing) {
      throw new ConflictException(`A folder named "${dto.name}" already exists here`);
    }

    return this.prisma.mediaFolder.create({
      data: {
        name: dto.name,
        slug,
        scope: dto.scope ?? 'cms',
        parentId: dto.parentId ?? null,
      },
    });
  }

  async findAll(scope?: string): Promise<FolderResponseDto[]> {
    return this.prisma.mediaFolder.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: number): Promise<FolderResponseDto> {
    const folder = await this.prisma.mediaFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException(`Folder #${id} not found`);
    return folder;
  }

  async rename(id: number, dto: RenameFolderDto): Promise<FolderResponseDto> {
    const existing = await this.prisma.mediaFolder.findUnique({
      where: { id },
      select: { parentId: true, scope: true },
    });
    if (!existing) throw new NotFoundException(`Folder #${id} not found`);

    const newSlug = this.toSlug(dto.name);

    const conflict = await this.prisma.mediaFolder.findFirst({
      where: { slug: newSlug, parentId: existing.parentId, id: { not: id } },
    });
    if (conflict) {
      throw new ConflictException(`A folder named "${dto.name}" already exists here`);
    }

    // Capture old chain before renaming
    const oldChain = await this.getSlugChain(id);

    const updated = await this.prisma.mediaFolder.update({
      where: { id },
      data: { name: dto.name, slug: newSlug },
    });

    // Build new chain (same parents, new slug at the end)
    const newChain = [...oldChain.slice(0, -1), newSlug];

    // Propagate to disk + DB only for cms-scoped folders
    if (existing.scope === 'cms') {
      await this.storageService.moveCmsFolderOnDisk(oldChain.join('/'), newChain.join('/'));
      await this.mediaRepo.updatePathPrefix(oldChain.join('/'), newChain.join('/'));
    }

    return updated;
  }

  async move(id: number, dto: MoveFolderDto): Promise<FolderResponseDto> {
    const existing = await this.prisma.mediaFolder.findUnique({
      where: { id },
      select: { scope: true },
    });
    if (!existing) throw new NotFoundException(`Folder #${id} not found`);

    const targetParentId = dto.targetParentId ?? null;

    if (targetParentId === id) {
      throw new BadRequestException('A folder cannot be moved into itself');
    }

    if (targetParentId !== null) {
      const circular = await this.isDescendant(id, targetParentId);
      if (circular) {
        throw new BadRequestException('Cannot move a folder into its own sub-folder');
      }
    }

    await this.assertDepth(targetParentId);

    // Capture old chain before moving
    const oldChain = await this.getSlugChain(id);

    await this.prisma.mediaFolder.update({
      where: { id },
      data: { parentId: targetParentId },
    });

    // Capture new chain after DB move
    const newChain = await this.getSlugChain(id);

    // Propagate to disk + DB only for cms-scoped folders
    if (existing.scope === 'cms') {
      await this.storageService.moveCmsFolderOnDisk(oldChain.join('/'), newChain.join('/'));
      await this.mediaRepo.updatePathPrefix(oldChain.join('/'), newChain.join('/'));
    }

    return this.prisma.mediaFolder.findUnique({ where: { id } }) as Promise<FolderResponseDto>;
  }

  async delete(id: number): Promise<void> {
    await this.findOne(id);

    const mediaCount = await this.prisma.media.count({ where: { folderId: id, deletedAt: null } });
    if (mediaCount > 0) {
      throw new ConflictException(
        `Folder contains ${mediaCount} file(s) — move or delete them first`,
      );
    }

    const subFolderCount = await this.prisma.mediaFolder.count({ where: { parentId: id } });
    if (subFolderCount > 0) {
      throw new ConflictException(
        `Folder contains ${subFolderCount} sub-folder(s) — remove them first`,
      );
    }

    await this.prisma.media.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    await this.prisma.mediaFolder.delete({ where: { id } });
  }

  // ─── Breadcrumbs ──────────────────────────────────────────────────────────────

  async getBreadcrumbs(id: number): Promise<FolderBreadcrumbDto[]> {
    const breadcrumbs: FolderBreadcrumbDto[] = [];
    let currentId: number | null = id;

    while (currentId !== null) {
      const folder: { id: number; name: string; slug: string; parentId: number | null } | null =
        await this.prisma.mediaFolder.findUnique({
          where: { id: currentId },
          select: { id: true, name: true, slug: true, parentId: true },
        });
      if (!folder) break;
      breadcrumbs.unshift({ id: folder.id, name: folder.name, slug: folder.slug });
      currentId = folder.parentId;
    }

    if (breadcrumbs.length === 0) {
      throw new NotFoundException(`Folder #${id} not found`);
    }

    return breadcrumbs;
  }
}
