import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MovieSearchService } from './movie-search/movie-search.service';

@Module({
  imports: [HttpModule],
  providers: [MovieSearchService],
  exports: [MovieSearchService],
})
export class MoviesModule {}
