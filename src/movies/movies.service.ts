import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from './entities/movie/movie';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
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
}
