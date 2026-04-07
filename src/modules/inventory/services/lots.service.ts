import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateLotDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Injectable()
export class LotsService {
  constructor(private prisma: PrismaService) {}

  private async generateLotNumber(): Promise<string> {
    const count = await this.prisma.lot.count();
    const date = new Date();
    return `LOT-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateLotDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const lotNumber = dto.lotNumber || (await this.generateLotNumber());

    return this.prisma.lot.create({
      data: {
        lotNumber,
        productId: dto.productId,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        manufactureDate: dto.manufactureDate
          ? new Date(dto.manufactureDate)
          : undefined,
        quantity: dto.quantity || 0,
        notes: dto.notes,
      },
      include: { product: true },
    });
  }

  findAll(productId?: string) {
    return this.prisma.lot.findMany({
      where: productId ? { productId } : {},
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: {
        product: true,
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    return lot;
  }

  findExpiring(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.lot.findMany({
      where: {
        expiryDate: { gte: new Date(), lte: cutoff },
        quantity: { gt: 0 },
      },
      include: { product: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  update(id: string, dto: Partial<CreateLotDto>) {
    return this.prisma.lot.update({
      where: { id },
      data: {
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        manufactureDate: dto.manufactureDate
          ? new Date(dto.manufactureDate)
          : undefined,
        notes: dto.notes,
      },
    });
  }
}
