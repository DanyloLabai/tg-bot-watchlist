import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from './entities/movie/movie';
import { User } from './entities/user/user.entity';
import { UserMovie } from './entities/user-movie/user-movie';
import { HttpService } from '@nestjs/axios';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { firstValueFrom } from 'rxjs';
// import { TmdbCreditsResponse } from './interfaces/movie-cast.interface';
// import { TMDBMovieDetails } from './interfaces/movie-owerview.interfece';
@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserMovie)
    private readonly userMovieRepository: Repository<UserMovie>,
    private readonly httpService: HttpService,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly apiKey = process.env.TMDB_API_KEY;
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  async create(movieData: Partial<Movie>): Promise<Movie> {
    const movie = this.movieRepository.create(movieData);

    return this.movieRepository.save(movie);
  }

  async findAll(): Promise<Movie[]> {
    return this.movieRepository.find();
  }

  async findById(id: number): Promise<Movie | null> {
    const cacheKey = `movie:details:${id}`;
    try {
      const cached = await this.cacheManager.get<Movie>(cacheKey);
      if (cached) {
        return cached;
      }

      const movie = await this.movieRepository.findOneBy({ id });
      if (movie) {
        await this.cacheManager.set(cacheKey, movie, 600);
      }
      return movie;
    } catch (error) {
      console.error(`Error in findById:`, error);
      return null;
    }
  }

  async findByTitle(title: string, year?: string): Promise<Movie | null> {
    try {
      return this.movieRepository.findOneBy({ title, year });
    } catch (error) {
      console.error(`Error in findByTitle:`, error);
      return null;
    }
  }

  async addToWatchlist(
    userId: number,
    movieData: Partial<Movie>,
  ): Promise<{ added: boolean; userMovie?: UserMovie }> {
    try {
      let user = await this.userRepository.findOneBy({ telegramId: userId });
      if (!user) {
        user = this.userRepository.create({ telegramId: userId });
        await this.userRepository.save(user);
      }

      let movie = await this.movieRepository.findOneBy({
        title: movieData.title,
        year: movieData.year,
      });
      if (!movie) {
        const safeMovieData: Partial<Movie> = {
          title: movieData.title ?? '',
          year: movieData.year ?? '',
          imdbRating: movieData.imdbRating ?? undefined,
          poster: movieData.poster ?? undefined,
        };
        movie = this.movieRepository.create(safeMovieData);
        await this.movieRepository.save(movie);
      }

      const existing = await this.userMovieRepository.findOne({
        where: {
          user: { id: user.id },
          movie: { id: movie.id },
        },
        relations: ['user', 'movie'],
      });

      if (existing) {
        return { added: false };
      }

      const userMovie = this.userMovieRepository.create({
        user,
        movie,
      });

      await this.userMovieRepository.save(userMovie);
      await this.cacheManager.del(`user:watchlist:${userId}`);
      return { added: true, userMovie };
    } catch (error) {
      console.error('Error in addToWatchlist:', error);
      return { added: false };
    }
  }

  async getUserWatchlist(userTelegramId: number): Promise<Movie[]> {
    const cacheKey = `user:watchlist:${userTelegramId}`;
    try {
      const cached = await this.cacheManager.get<Movie[]>(cacheKey);
      if (cached) {
        return cached;
      }
      const user = await this.userRepository.findOne({
        where: { telegramId: userTelegramId },
      });

      if (!user) {
        return [];
      }
      const userMovies = await this.userMovieRepository.find({
        where: { user: { id: user.id } },
        relations: ['movie'],
      });

      const movies = userMovies.map((mov) => mov.movie);

      await this.cacheManager.set(cacheKey, movies, 300);

      return movies;
    } catch (error) {
      console.error('Error in getUserWatchlist:', error);
      return [];
    }
  }

  async deleteFromWatchlist(
    userTelegramId: number,
    movieId: number,
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { telegramId: userTelegramId },
      });
      if (!user) return false;

      const userMovie = await this.userMovieRepository.findOne({
        where: {
          user: { id: user.id },
          movie: { id: movieId },
        },
        relations: ['user', 'movie'],
      });
      if (!userMovie) return false;

      await this.userMovieRepository.remove(userMovie);
      await this.cacheManager.del(`user:watchlist:${userTelegramId}`);

      return true;
    } catch (error) {
      console.error('Error in getUserWatchlist:', error);
      return false;
    }
  }
  // Cast and description
  //   async getMovieCast(movieId: number): Promise<string[]> {
  //     const url = `${this.tmdbBaseUrl}/movie/${movieId}/credits?api_key=${this.apiKey}`;

  //     const response = await firstValueFrom(
  //       this.httpService.get<TmdbCreditsResponse>(url),
  //     );

  //     const cast = response.data.cast?.slice(0, 5);
  //     if (!cast || cast.length === 0) return [];

  //     return cast.map((actor) => `${actor.name} (${actor.character})`);
  //   }
  //   async getMovieOverview(movieId: number): Promise<string> {
  //     const url = `${this.tmdbBaseUrl}/movie/${movieId}?api_key=${this.apiKey}`;

  //     const response = await firstValueFrom(
  //       this.httpService.get<TMDBMovieDetails>(url),
  //     );
  //     const movie = response.data;

  //     return movie.overview ?? 'No overview available.';
  //   }
}
