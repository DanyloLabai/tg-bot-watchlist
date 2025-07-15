import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { MovieSearchService } from 'src/movies/movie-search/movie-search.service';
import { MoviesService } from 'src/movies/movies.service';
import { SearchResult } from 'src/movies/interfaces/tmdbReslResp.interface';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot?: Telegraf;
  private readonly userState = new Map<number, 'idle' | 'awaiting_search'>();
  private tempResults = new Map<number, SearchResult[]>();

  constructor(
    private configService: ConfigService,
    private moviesSearchService: MovieSearchService,
    private moviesService: MoviesService,
  ) {}

  private getReplyKeyboard(show = true) {
    return show
      ? Markup.keyboard([['Search movie', 'View watchlist']])
          .resize()
          .persistent()
      : Markup.removeKeyboard();
  }

  onModuleInit() {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) throw new Error('BOT_TOKEN not defined in env');

    this.bot = new Telegraf(token);

    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
    ]);

    this.bot.start((ctx) => {
      this.userState.set(ctx.from.id, 'idle');
      ctx.setChatMenuButton({ type: 'commands' });
      return ctx.reply('Welcome to Watchlist!', this.getReplyKeyboard());
    });

    this.bot.hears('Search movie', async (ctx) => {
      try {
        this.userState.set(ctx.from.id, 'awaiting_search');
        await ctx.reply('Enter movie title:');
      } catch (error) {
        console.error('Error', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.hears('View watchlist', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const watchlist = await this.moviesService.getUserWatchlist(userId);

        if (watchlist.length === 0) {
          return ctx.reply('Your watchlist is empty.');
        }

        let message = '*Your Watchlist:*\n\n';
        message += watchlist
          .map((m, i) => `${i + 1}. ${m.title} (${m.year})`)
          .join('\n');

        await ctx.reply(message, { parse_mode: 'Markdown' });

        const truncateTitle = (title: string, maxLength = 25): string => {
          return title.length > maxLength ? title.slice(0, maxLength - 1) + '…' : title;
        };

        const buttons = [];
        for (let i = 0; i < watchlist.length; i += 2) {
          const row = [];

          const first = watchlist[i];
          row.push(
            Markup.button.callback(
              `${i + 1}. ${truncateTitle(first.title)}`,
              `show_${first.id}`,
            ),
          );
          if (watchlist[i + 1]) {
            const second = watchlist[i + 1];
            row.push(
              Markup.button.callback(
                `${i + 2}. ${truncateTitle(second.title)}`,
                `show_${second.id}`,
              ),
            );
          }
          buttons.push(row);
        }

        await ctx.reply('Choose a movie:', Markup.inlineKeyboard(buttons));
      } catch (error) {
        console.error('Error', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.on('text', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const state = this.userState.get(userId);

        if (state !== 'awaiting_search') {
          return ctx.reply(
            'No action selected. Please select one of the menu buttons.',
          );
        }

        this.userState.set(userId, 'idle');

        const input = ctx.message.text.trim();
        const match = input.match(/^(.*?)(?:\s+(\d{4}))?$/);
        const title = match?.[1]?.trim() ?? '';
        const year = match?.[2] ? parseInt(match[2]) : undefined;

        const movies = await this.moviesSearchService.searchByTitle(
          title,
          year,
        );

        if (!movies || movies.length === 0) {
          return ctx.reply('No results found.');
        }

        this.tempResults.set(userId, movies);

        let message = ` *Found results for "${title}":*\n\n`;
        message += movies
          .map(
            (m, i) =>
              `${i + 1}.  *${m.title}* (${m.year}) –  ${m.imdbRating.toFixed(1)}`,
          )
          .join('\n');

        const buttons = movies.map((_, i) =>
          Markup.button.callback(`${i + 1}`, `choose_${i}`),
        );

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        });
      } catch (error) {
        console.error('Error in text handle', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.action(/add_(\d+)/, async (ctx) => {
      try {
        const movieId = parseInt(ctx.match[1], 10);
        const userId = ctx.from.id;

        if (isNaN(movieId)) {
          return ctx.answerCbQuery('Invalid movie ID', { show_alert: true });
        }

        const movie = await this.moviesService.findById(movieId);
        if (!movie) {
          return ctx.answerCbQuery('Movie not found', { show_alert: true });
        }

        const result = await this.moviesService.addToWatchlist(userId, movie);
        await ctx.answerCbQuery(
          result.added ? 'Movie added!' : 'Already in your watchlist',
        );
        await ctx.editMessageReplyMarkup(undefined);
      } catch (error) {
        console.error('Error in added', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.action(/choose_(\d+)/, async (ctx) => {
      try {
        const userId = ctx.from.id;
        const index = parseInt(ctx.match[1]);

        const movies = this.tempResults?.get(userId);
        if (!movies || !movies[index]) {
          return ctx.reply('Movie not found.');
        }

        const movieData = movies[index];

        this.tempResults.delete(userId);

        let movie = await this.moviesService.findByTitle(movieData.title, movieData.year);
        if (!movie) {
          movie = await this.moviesService.create({
            ...movieData,
            poster: movieData.poster ?? undefined,
          });
        }

        const caption = `*${movie.title}* (${movie.year})\nIMDb: ${movie.imdbRating?.toFixed(1) ?? 'N/A'}`;
        const buttons = Markup.inlineKeyboard([
          Markup.button.callback('Add to watchlist', `add_${movie.id}`),
        ]);

        if (movie.poster) {
          return ctx.replyWithPhoto(movie.poster, {
            caption,
            parse_mode: 'Markdown',
            ...buttons,
          });
        } else {
          return ctx.reply(caption, { parse_mode: 'Markdown', ...buttons });
        }
      } catch (error) {
        console.error('Error', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.action(/show_(.+)/, async (ctx) => {
      try {
        const movieId = parseInt(ctx.match[1], 10);
        if (isNaN(movieId)) {
          return ctx.reply('Invalid movie ID.');
        }

        const movie = await this.moviesService.findById(movieId);
        if (!movie) return ctx.reply('Movie not found.');

        const caption = `*${movie.title}* (${movie.year})\nIMDb: ${movie.imdbRating ?? 'N/A'}`;
        const buttons = Markup.inlineKeyboard([
          [Markup.button.callback('Remove', `remove_${movie.id}`)],
        ]);

        if (movie.poster) {
          return ctx.replyWithPhoto(movie.poster, {
            caption,
            parse_mode: 'Markdown',
            ...buttons,
          });
        } else {
          return ctx.reply(caption, { parse_mode: 'Markdown', ...buttons });
        }
      } catch (error) {
        console.error('Error', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    this.bot.action(/remove_(.+)/, async (ctx) => {
      try {
        const movieId = parseInt(ctx.match[1]);
        const userId = ctx.from.id;

        const removed = await this.moviesService.deleteFromWatchlist(
          userId,
          movieId,
        );
        await ctx.answerCbQuery(
          removed ? 'Removed from watchlist' : 'Not found in watchlist',
        );
        await ctx.editMessageReplyMarkup(undefined);
      } catch (error) {
        console.error('Error', error);
        await ctx.reply('Oops, something went wrong. Please try again later.');
      }
    });

    void this.bot.launch();
    console.log('Bot started');
  }
}
