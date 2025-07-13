import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

interface TMDBMovieResult {
  title: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
}

interface TMDBResponse {
  results: TMDBMovieResult[];
}

@Injectable()
export class MovieSearchService {
  constructor(private readonly httpService: HttpService) {}

  async searchByTitle(title: string, year?: number) {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      throw new Error('TMDB_API_KEY is not set');
    }

    const queryParams = new URLSearchParams({
      api_key: apiKey,
      query: title,
    });

    if (year) {
      queryParams.append('year', year.toString());
    }

    const url = `https://api.themoviedb.org/3/search/movie?${queryParams.toString()}`;

    const response: AxiosResponse<TMDBResponse> = await firstValueFrom(
      this.httpService.get<TMDBResponse>(url),
    );
    const data = response.data;

    if (!data.results || data.results.length === 0) return null;

    const posterBaseUrl = 'https://image.tmdb.org/t/p/w500';

    let movie: TMDBMovieResult | undefined;

    if (year) {
      movie = data.results.find((m) =>
        m.release_date?.startsWith(year.toString()),
      );

      if (!movie) {
        return null;
      }
    } else {
      movie = data.results[0];
    }

    return {
      title: movie.title,
      year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
      imdbRating: movie.vote_average,
      poster: movie.poster_path ? posterBaseUrl + movie.poster_path : null,
    };
  }
}
