import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { MovieSearchService } from 'src/movies/movie-search/movie-search.service';
import { MoviesService } from 'src/movies/movies.service';
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot?: Telegraf;

  constructor(
    private configService: ConfigService,
    private moviesSearchService: MovieSearchService,
    private moviesService: MoviesService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN not defined in env');
    }
    this.bot = new Telegraf(token);
    this.bot.start((ctx) => {
      ctx.reply('Hello! Send a movie title,to add to watchlist');
    });

    this.bot.on('text', async (ctx) => {
      const input = ctx.message.text.trim();

      const match = input.match(/^(.*?)(?:\s+(\d{4}))?$/);
      const title = match?.[1]?.trim() ?? '';
      const year = match?.[2] ? parseInt(match[2]) : undefined;
      const movie = await this.moviesSearchService.searchByTitle(title, year);

      if (!movie) {
        return ctx.reply('Movie not found', Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      const caption = ` *${movie.title}* (${movie.year})\n IMDb: ${movie.imdbRating?.toFixed(1) ?? "N/A"}`;

      const buttons = Markup.inlineKeyboard([
        Markup.button.callback('Add to watchlist', `add_${movie.title}`),
        Markup.button.callback('Search movie', 'next'),
        Markup.button.callback('View watchlist', 'show_watchlist'),
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
    });
    this.bot.action(/add_(.+)/, async (ctx) => {
      const movieTitle = ctx.match[1];
      const userId = ctx.from.id;

      let movie = await this.moviesService.findByTitle(movieTitle);
      if (!movie) {
        const movieData = await this.moviesSearchService.searchByTitle(movieTitle);
        if (!movieData) {
          return ctx.answerCbQuery(' Movie not found', { show_alert: true });
        }

        const cleanedData = {
          ...movieData,
          poster: movieData.poster ?? undefined,
        };

        movie = await this.moviesService.create(cleanedData);
      }

      const result = await this.moviesService.addToWatchlist(userId, movie);

      if (!result.added) {
        await ctx.answerCbQuery(' Movie already in your watchlist!');
      } else {
        await ctx.answerCbQuery(' Movie added!');
      }

      await ctx.editMessageReplyMarkup(undefined);

      await ctx.reply(
        'What would you like to do next?',
        Markup.inlineKeyboard([
          [Markup.button.callback(' View watchlist', 'show_watchlist')],
          [Markup.button.callback(' Search movie', 'next')],
        ]),
      );
    });

    this.bot.action('show_watchlist', async (ctx) => {
      await ctx.answerCbQuery();

      const userId = ctx.from.id;
      const watchlist = await this.moviesService.getUserWatchlist(userId);

      if (watchlist.length === 0) {
        return ctx.reply(' Your watchlist is empty', Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      let message = '* Your Watchlist:*\n\n';
      message += watchlist.map((m, i) => `${i + 1}. ${m.title} (${m.year})`).join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });

      await ctx.reply(
        'What next?',
        Markup.inlineKeyboard([
          [Markup.button.callback(' Search movie', 'next')],
          [Markup.button.callback(' Remove movie', 'show_remove')],
        ]),
      );
    });

    this.bot.action('show_remove', async (ctx) => {
      await ctx.answerCbQuery();

      const userId = ctx.from.id;
      const watchlist = await this.moviesService.getUserWatchlist(userId);

      if (watchlist.length === 0) {
        return ctx.reply(' Your watchlist is empty.');
      }

      const removeButtons = watchlist.map((movie) => [
        Markup.button.callback(` Remove ${movie.title}`, `remove_${movie.title}`),
      ]);

      removeButtons.push([
        Markup.button.callback(' Search movie', 'next'),
        Markup.button.callback(' View watchlist', 'show_watchlist'),
      ]);

      await ctx.reply(' *Choose a movie to remove:*', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(removeButtons),
      });
    });

    this.bot.action(/remove_(.+)/, async (ctx) => {
      const title = ctx.match[1];
      const userId = ctx.from.id;

      const removed = await this.moviesService.deleteFromWatchlist(userId, title);

      if (removed) {
        await ctx.answerCbQuery(` Removed "${title}" from your watchlist.`);

        await ctx.reply(
          'What would you like to do next?',
          Markup.inlineKeyboard([
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
            [Markup.button.callback(' Search movie', 'next')],
          ]),
        );
      } else {
        await ctx.answerCbQuery(` Movie not found in your watchlist.`);
      }

      await ctx.editMessageReplyMarkup(undefined);
    });



    this.bot.action('next', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.reply('Enter movie title:');
    });

    this.bot.launch();
    console.log('Bot start');
  }
}
