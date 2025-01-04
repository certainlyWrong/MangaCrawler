import chalk from "chalk";

export const helloCommand = async (name: string) => {
  console.log(chalk.green(`Olá, ${name}! Bem-vindo à minha CLI!`));
};
