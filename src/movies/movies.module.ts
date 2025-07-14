import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { MovieSearchService } from './movie-search/movie-search.service';
import { Movie } from './entities/movie/movie';
import { UserMovie } from './entities/user-movie/user-movie';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { User } from './entities/user/user.entity';
import * as redisStore from 'cache-manager-ioredis';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Movie, UserMovie, User]),
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore,
        host: 'redis',
        port: 6379,
        ttl: 300,
      }),
    }),
  ],
  providers: [MovieSearchService, MoviesService],
  exports: [MovieSearchService, MoviesService],
  controllers: [MoviesController],
})
export class MoviesModule {}
