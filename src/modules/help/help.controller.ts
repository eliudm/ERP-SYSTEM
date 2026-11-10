import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HelpService } from './help.service';

@Controller('help')
export class HelpController {
  constructor(private readonly service: HelpService) {}

  // Public endpoints — no auth needed for help content
  @Get('seed')
  seed() { return this.service.seedContent(); }

  @Get('categories')
  listCategories() { return this.service.listCategories(); }

  @Get('articles')
  listArticles(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) { return this.service.listArticles(category, search); }

  @Get('articles/:slug')
  getArticle(@Param('slug') slug: string) { return this.service.getArticle(slug); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('articles/:slug/feedback')
  markHelpful(@Param('slug') slug: string, @Body() body: { helpful: boolean }) {
    return this.service.markHelpful(slug, body.helpful);
  }
}
