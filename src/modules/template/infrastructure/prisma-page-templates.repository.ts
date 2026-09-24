import { ConflictException, Injectable } from '@nestjs/common';
import { PageTemplate } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IPageTemplatesRepository } from '../domain/page-templates.repository';
import { CreatePageTemplateDto, UpdatePageTemplateDto, PageTemplateQueryDto } from '../dto';
import { PaginatedResult, PaginationOptions } from '@/common/pagination';

@Injectable()
export class PrismaPageTemplatesRepository implements IPageTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePageTemplateDto): Promise<PageTemplate> {
    return this.prisma.pageTemplate.create({
      data: {
        slug: data.slug,
        createdById: null,
        updatedById: null,
      },
      include: this.getInclude(),
    });
  }

  async findAll(query?: PageTemplateQueryDto): Promise<PageTemplate[]> {
    const where: any = {};

    if (query?.search) {
      where.slug = { contains: query.search, mode: 'insensitive' };
    }

    if (query?.createdById) {
      where.createdById = query.createdById;
    }

    return this.prisma.pageTemplate.findMany({
      where,
      include: this.getInclude(),
      orderBy: { createdAt: 'desc' },
      take: query?.limit,
    });
  }

  async findPaginated(
    query?: PageTemplateQueryDto,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PageTemplate>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(query);

    const [data, total] = await Promise.all([
      this.prisma.pageTemplate.findMany({
        where,
        include: this.getInclude(),
        orderBy: pagination?.sortBy
          ? { [pagination.sortBy]: pagination.sortOrder ?? 'asc' }
          : { id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.pageTemplate.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number): Promise<PageTemplate | null> {
    return this.prisma.pageTemplate.findUnique({
      where: { id },
      include: this.getInclude(),
    });
  }

  async findBySlug(slug: string): Promise<PageTemplate | null> {
    return this.prisma.pageTemplate.findUnique({
      where: { slug },
      include: this.getInclude(),
    });
  }

  async update(id: number, data: UpdatePageTemplateDto): Promise<PageTemplate> {
    return this.prisma.pageTemplate.update({
      where: { id },
      data: {
        slug: data.slug,
        updatedById: null,
      },
      include: this.getInclude(),
    });
  }

  async delete(id: number): Promise<PageTemplate> {
    const pagesUsingTemplate = await this.prisma.page.count({
      where: { templateId: id },
    });

    if (pagesUsingTemplate > 0) {
      throw new ConflictException(
        `Cannot delete template. ${pagesUsingTemplate} page(s) are using this template.`,
      );
    }

    return this.prisma.pageTemplate.delete({
      where: { id },
    });
  }

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const count = await this.prisma.pageTemplate.count({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return count > 0;
  }

  async findByCreator(userId: number): Promise<PageTemplate[]> {
    return this.prisma.pageTemplate.findMany({
      where: { createdById: userId },
      include: this.getInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecentlyUpdated(limit: number = 10): Promise<PageTemplate[]> {
    return this.prisma.pageTemplate.findMany({
      include: this.getInclude(),
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  private getInclude() {
    return {
      createdBy: {
        select: { id: true, email: true },
      },
      updatedBy: {
        select: { id: true, email: true },
      },
    };
  }

  private buildWhere(filters?: PageTemplateQueryDto) {
    if (!filters) return {};
    const where: any = {};
    if (filters.search) {
      where.slug = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.createdById) {
      where.createdById = filters.createdById;
    }
    return where;
  }
}
