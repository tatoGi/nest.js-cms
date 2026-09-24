// src/common/pagination/prisma-paginate.ts

export async function prismaPaginate<T>(
  model: {
    findMany: Function;
    count: Function;
  },
  args: {
    where?: any;
    include?: any;
    orderBy?: any;
  },
  pagination: {
    page: number;
    limit: number;
    skip: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): Promise<{
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, skip, sortBy, sortOrder } = pagination;

  const [data, total] = await Promise.all([
    model.findMany({
      ...args,
      skip,
      take: limit,
      orderBy: sortBy ? { [sortBy]: sortOrder } : args.orderBy,
    }),
    model.count({ where: args.where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
