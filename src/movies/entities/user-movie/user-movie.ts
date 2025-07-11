import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Movie } from '../movie/movie';

@Entity()
export class UserMovie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @ManyToOne(() => Movie, (movie) => movie.userMovies, { cascade: true })
  @JoinColumn({ name: 'movieId' })
  movie!: Movie;

  @Column()
  movieId!: number;
}
