import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UpdateProgramDto } from '../dto/chat.dto';

// Chat reporting taxonomy — internal-only, never shown to visitors, no
// translations. Mirrors RegionsService exactly (same shape/rules).
@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrograms() {
    return this.prisma.program.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async getProgramsPaginated(skip = 0, take = 5) {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.program.count({ where }),
    ]);
    return { items, total };
  }

  async getTrashedPrograms() {
    return this.prisma.program.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async createProgram(name: string) {
    return this.prisma.program.create({ data: { name } });
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    return this.prisma.program.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async trashProgram(id: string) {
    return this.prisma.program.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restoreProgram(id: string) {
    return this.prisma.program.update({ where: { id }, data: { deletedAt: null } });
  }

  async deleteProgram(id: string) {
    return this.prisma.program.delete({ where: { id } });
  }

  async bulkRestorePrograms(ids: string[]) {
    return this.prisma.program.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
  }

  async bulkDeletePrograms(ids: string[]) {
    return this.prisma.program.deleteMany({ where: { id: { in: ids } } });
  }
}
