import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { Movie } from './entities/movie/movie';

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

  @Post('watchlist/:userId')
  async addToWatchlist(
    @Param('userId') userId: number,
    @Body() movieData: Partial<Movie>,
  ) {
    return this.moviesService.addToWatchlist(userId, movieData);
  }
}
