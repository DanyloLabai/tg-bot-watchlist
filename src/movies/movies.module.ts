import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MovieSearchService } from './movie-search/movie-search.service';
import { Movie } from './entities/movie/movie';
import { UserMovie } from './entities/user-movie/user-movie';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Movie, UserMovie])],
  providers: [MovieSearchService],
  exports: [MovieSearchService],
})
export class MoviesModule {}
