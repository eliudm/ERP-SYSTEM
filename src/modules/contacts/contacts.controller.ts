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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ContactsService,
  CreateContactDto,
  UpdateContactDto,
} from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContactType } from '@prisma/client';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @ApiOperation({ summary: 'List contacts, optionally filtered by search term and type' })
  @Get()
  findAll(@Query('search') search?: string, @Query('type') type?: ContactType) {
    return this.contactsService.findAll(search, type);
  }

  @ApiOperation({ summary: 'List company-type contacts, optionally filtered by search term' })
  @Get('companies')
  getCompanies(@Query('search') search?: string) {
    return this.contactsService.getCompanies(search);
  }

  @ApiOperation({ summary: 'Get a single contact by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new contact' })
  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @ApiOperation({ summary: 'Update a contact' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a contact' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
