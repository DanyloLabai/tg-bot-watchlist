import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  TMDBResponse,
  SearchResult,
  TMDBSearchResult,
  TMDBMovieResult,
  TMDBTvResult,
} from '../interfaces/tmdbReslResp.interface';

@Injectable()
export class MovieSearchService {
  constructor(
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private isMovie(result: TMDBSearchResult): result is TMDBMovieResult {
    return (result as TMDBMovieResult).release_date !== undefined;
  }

  private isTv(result: TMDBSearchResult): result is TMDBTvResult {
    return (result as TMDBTvResult).first_air_date !== undefined;
  }

  async searchByTitle(title: string, year?: number): Promise<SearchResult[]> {
    try {
      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) throw new Error('TMDB_API_KEY is not set');

      const posterBaseUrl = 'https://image.tmdb.org/t/p/w500';
      const searchTypes = ['movie', 'tv'];
      const cacheKey = `tmdb:search:${title.toLowerCase()}:${year ?? 'any'}`;

      const cached = await this.cacheManager.get<SearchResult[]>(cacheKey);
      if (cached) return cached;

      let combinedResults: SearchResult[] = [];

      for (const type of searchTypes) {
        const queryParams = new URLSearchParams({
          api_key: apiKey,
          query: title,
        });
        if (year) {
          queryParams.append('year', year.toString());
        }

        const url = `https://api.themoviedb.org/3/search/${type}?${queryParams.toString()}`;

        const response: AxiosResponse<TMDBResponse> = await firstValueFrom(
          this.httpService.get<TMDBResponse>(url),
        );

        const data = response.data;
        if (!data.results || data.results.length === 0) continue;

        const filteredSorted = data.results
          .filter(
            (m) =>
              m.vote_average > 0 &&
              (!year ||
                (this.isMovie(m)
                  ? m.release_date?.startsWith(year.toString())
                  : m.first_air_date?.startsWith(year.toString()))),
          )
          .sort((a, b) => b.vote_average - a.vote_average)
          .slice(0, 5);

        const mappedResults = filteredSorted.map((m) => {
          if (this.isMovie(m)) {
            return {
              title: m.title,
              year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
              imdbRating: m.vote_average,
              poster: m.poster_path ? posterBaseUrl + m.poster_path : null,
            };
          } else {
            return {
              title: m.name,
              year: m.first_air_date ? m.first_air_date.split('-')[0] : 'N/A',
              imdbRating: m.vote_average,
              poster: m.poster_path ? posterBaseUrl + m.poster_path : null,
            };
          }
        });

        combinedResults = combinedResults.concat(mappedResults);
      }

      combinedResults = combinedResults
        .sort((a, b) => b.imdbRating - a.imdbRating)
        .slice(0, 8);

      await this.cacheManager.set(cacheKey, combinedResults, 3600);

      return combinedResults;
    } catch (error) {
      console.error('Error in searchByTitle:', error);
      return [];
    }
  }
}
