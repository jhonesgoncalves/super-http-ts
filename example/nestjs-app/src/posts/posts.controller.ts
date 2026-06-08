import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { PostsService, Post as PostEntity } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(): Promise<PostEntity[]> {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PostEntity> {
    return this.postsService.findOne(id);
  }

  @Get(':id/with-comments')
  findWithComments(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findWithComments(id);
  }

  @Post()
  create(@Body() dto: Omit<PostEntity, 'id'>): Promise<PostEntity> {
    return this.postsService.create(dto);
  }
}
