import { prisma } from "@/lib/prisma";

interface CreateLogParams {
  userId: number;
  licensePlate: string;
  status: string;
  condition?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lokasi?: string | null;
}

interface FindAllParams {
  page: number;
  limit: number;
  skip: number;
  userId?: number;
  search?: string;
  status?: string;
  condition?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const vehicleTaxRepository = {
  async create(data: CreateLogParams) {
    return prisma.vehicleTaxCheckLog.create({
      data: {
        userId: data.userId,
        licensePlate: data.licensePlate,
        status: data.status,
        condition: data.condition ?? null,
        notes: data.notes ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        lokasi: data.lokasi ?? null,
      },
    });
  },

  async findLatestByPlate(licensePlate: string) {
    return prisma.vehicleTaxCheckLog.findFirst({
      where: { licensePlate: { equals: licensePlate, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
  },

  async findAll({ page, limit, skip, userId, search, status, condition, dateFrom, dateTo }: FindAllParams) {
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (condition) {
      where.condition = condition;
    }

    // dateTo inklusif: batas atas = awal hari berikutnya.
    if (dateFrom || dateTo) {
      const range: { gte?: Date; lt?: Date } = {};
      if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) {
        const end = new Date(`${dateTo}T00:00:00`);
        end.setDate(end.getDate() + 1);
        range.lt = end;
      }
      where.createdAt = range;
    }

    if (search) {
      where.OR = [
        { licensePlate: { contains: search, mode: "insensitive" } },
        { lokasi: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.vehicleTaxCheckLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vehicleTaxCheckLog.count({ where }),
    ]);

    return { data, total };
  },
};
