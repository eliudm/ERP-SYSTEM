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
          data: { serial, productId, warehouseId },
        }),
      ),
    );
  }

  findAll(productId?: string, status?: string) {
    return this.prisma.serialNumber.findMany({
      where: {
        ...(productId && { productId }),
        ...(status && { status: status as any }),
      },
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySerial(serial: string) {
    const sn = await this.prisma.serialNumber.findUnique({
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
