import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from './entities/movie/movie';
import { User } from './entities/user/user.entity';
import { UserMovie } from './entities/user-movie/user-movie';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserMovie)
    private readonly userMovieRepository: Repository<UserMovie>,
  ) {}

  async create(movieData: Partial<Movie>): Promise<Movie> {
    const movie = this.movieRepository.create(movieData);

    return this.movieRepository.save(movie);
  }

  async findAll(): Promise<Movie[]> {
    return this.movieRepository.find();
  }

  async findById(id: number): Promise<Movie | null> {
    return this.movieRepository.findOneBy({ id });
  }

  async findByTitle(title: string): Promise<Movie | null> {
    return this.movieRepository.findOneBy({ title });
  }

  async addToWatchlist(
    userId: number,
    movieData: Partial<Movie>,
  ): Promise<{ added: boolean; userMovie?: UserMovie }> {
    let user = await this.userRepository.findOneBy({ telegramId: userId });
    if (!user) {
      user = this.userRepository.create({ telegramId: userId });
      await this.userRepository.save(user);
    }

    let movie = await this.movieRepository.findOneBy({
      title: movieData.title,
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

    return { added: true, userMovie };
  }

  async getUserWatchlist(userTelegramId: number): Promise<Movie[]> {
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

    return userMovies.map((mov) => mov.movie);
  }
}
