import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MovieSearchService } from './movie-search/movie-search.service';
import { Movie } from './entities/movie/movie';
import { UserMovie } from './entities/user-movie/user-movie';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Movie, UserMovie])],
  providers: [MovieSearchService, MoviesService],
  exports: [MovieSearchService, MoviesService],
  controllers: [MoviesController],
})
export class MoviesModule {}
