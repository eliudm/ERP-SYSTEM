import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ContactsService,
  CreateContactDto,
  UpdateContactDto,
} from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContactType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(@Query('search') search?: string, @Query('type') type?: ContactType) {
    return this.contactsService.findAll(search, type);
  }

  @Get('companies')
  getCompanies(@Query('search') search?: string) {
    return this.contactsService.getCompanies(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
