import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { MovieSearchService } from "src/movies/movie-search/movie-search.service";

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot?: Telegraf;

  constructor(
    private configService: ConfigService,
    private moviesSearchService: MovieSearchService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>("BOT_TOKEN");
    if (!token) {
      throw new Error("BOT_TOKEN not defined in env");
    }
    this.bot = new Telegraf(token);
    this.bot.start((ctx) => {
      ctx.reply("Hello! Send a movie title,to add to watchlist");
    });

    this.bot.on("text", async (ctx) => {
      const title = ctx.message.text;
      const movie = await this.moviesSearchService.searchByTitle(title);

      if (!movie) {
        return ctx.reply("Movie not found");
      }

      const caption = `🎬 *${movie.title}* (${movie.year})\n⭐ IMDb: ${movie.imdbRating?.toFixed(1) ?? "N/A"}`;

      if (movie.poster) {
        return ctx.replyWithPhoto(movie.poster, {
          caption,
          parse_mode: "Markdown",
        });
      } else {
        return ctx.reply(caption, { parse_mode: "Markdown" });
      }
    });

    this.bot.launch();
    console.log("Bot start");
  }
}
