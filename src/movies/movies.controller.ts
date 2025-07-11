import { Controller, Get, Param } from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  async getAll() {
    return this.moviesService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: number) {
    return this.moviesService.findById(id);
  }
}
