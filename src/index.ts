import { Command } from "commander";
import { helloCommand } from "./commands/hello_command";
import chalk from "chalk";
import { getMetaCommand } from "./commands/get_meta_command";
import { getCapsCommand } from "./commands/get_caps_command";
import { saveSqliteCommand } from "./commands/save_sqlite_command";

const program = new Command();

program
  .name("mm")
  .description("A cli to scrap Manga from the web")
  .version("1.0.0");

program
  .command("hello")
  .description("Say hello")
  .option("-n, --name <name>", "User name", "adriano")
  .action((options) => {
    helloCommand(options.name);
  });

program
  .command("get-meta")
  .description("Get meta from manga")
  .option("-l, --last-page <lastPage>", "Last page to get meta", "5")
  .option("-t, --threads <threads>", "Number of threads", "5")
  .action(async (options) => {
    if (
      options.lastPage &&
      !isNaN(parseInt(options.lastPage)) &&
      options.threads &&
      !isNaN(parseInt(options.threads))
    ) {
      const lastPage = parseInt(options.lastPage);
      const threads = parseInt(options.threads);

      await getMetaCommand(lastPage, threads);

      console.log(chalk.green(`Getting meta from ${lastPage} pages`));
    } else {
      console.log(chalk.red("Error: lastPage is not a number"));
    }
  });

program.command("get-caps")
  .description("Get caps from manga")
  .option("-t, --threads <threads>", "Number of threads", "5")
  .action(async (options) => {
    if (options.threads && !isNaN(parseInt(options.threads))) {
      const threads = parseInt(options.threads);

      console.log(chalk.green(`Getting caps from ${threads} threads`));

      await getCapsCommand(threads);

      console.log(chalk.green(`Getting caps from ${threads} threads`));
    } else {
      console.log(chalk.red("Error: threads is not a number"));
    }
  });

program.command("save-sqlite")
  .description("Save data to sqlite")
  .option("-p, --path <path>", "Path to sqlite file", "manga.db")
  .action((option) => {
    saveSqliteCommand(option.path);
  });

program.parse(process.argv);
