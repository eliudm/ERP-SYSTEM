import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export class CreateSerialDto {
  productId: string;
  serial: string;
  warehouseId?: string;
}

@Injectable()
export class SerialNumbersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSerialDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.serialNumber.create({
      data: {
        tenantId: product.tenantId,
        serial: dto.serial,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
      },
      include: { product: true, warehouse: true },
    });
  }

  async bulkCreate(productId: string, serials: string[], warehouseId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.$transaction(
      serials.map((serial) =>
        this.prisma.serialNumber.create({
          data: { tenantId: product.tenantId, serial, productId, warehouseId },
        }),
      ),
    );
  }

  findAll(productId?: string, status?: string, page = 1, limit = 200) {
    return this.prisma.serialNumber.findMany({
      where: {
        ...(productId && { productId }),
        ...(status && { status: status as any }),
      },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findBySerial(serial: string) {
    // findFirst, not findUnique: serial is only unique per-tenant now, and
    // the tenant filter is applied automatically (tenant-scoping.extension.ts)
    const sn = await this.prisma.serialNumber.findFirst({
      where: { serial },
      include: { product: true, warehouse: true },
    });
    if (!sn) throw new NotFoundException('Serial number not found');
    return sn;
  }

  updateStatus(id: string, status: string, warehouseId?: string) {
    return this.prisma.serialNumber.update({
      where: { id },
      data: { status: status as any, ...(warehouseId && { warehouseId }) },
    });
  }
}
