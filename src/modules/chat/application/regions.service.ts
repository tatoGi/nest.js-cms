import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UpdateRegionDto } from '../dto/chat.dto';

// Chat reporting taxonomy — same shape/rules as ProgramsService.
@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRegions() {
    return this.prisma.region.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async getRegionsPaginated(skip = 0, take = 5) {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.region.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.region.count({ where }),
    ]);
    return { items, total };
  }

  async getTrashedRegions() {
    return this.prisma.region.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async createRegion(name: string) {
    return this.prisma.region.create({ data: { name } });
  }

  async updateRegion(id: string, dto: UpdateRegionDto) {
    return this.prisma.region.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async trashRegion(id: string) {
    return this.prisma.region.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreRegion(id: string) {
    return this.prisma.region.update({ where: { id }, data: { deletedAt: null } });
  }

  async deleteRegion(id: string) {
    return this.prisma.region.delete({ where: { id } });
  }

  async bulkRestoreRegions(ids: string[]) {
    return this.prisma.region.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  }

  async bulkDeleteRegions(ids: string[]) {
    return this.prisma.region.deleteMany({ where: { id: { in: ids } } });
  }
}
