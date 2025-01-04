import { Worker } from "worker_threads";
import path from "path";
import chalk from "chalk";
import { stringifyNumber } from "../common/stringfy_number";

export const getMetaCommand = async (
  lastPage: number = 5,
  countThreads: number = 5
) => {
  const countCardsPages = lastPage;
  const countRange = Math.floor(countCardsPages / countThreads);
  const metaWorkers: Worker[] = [];

  console.log(
    chalk.yellow(
      `Processing ${countCardsPages} pages || ${countThreads} threads || ${countRange} range`
    )
  );

  let countWorkers = 0;
  for (let i = 0; i < countThreads; i++) {
    countWorkers++;

    console.log(
      chalk.blue(
        `Initial ${stringifyNumber(
          i * countRange + 1
        )} - Final ${stringifyNumber((i + 1) * countRange)}`
      )
    );

    const worker = new Worker(
      path.join(__dirname, "../workers", "fullmeta_worker.ts"),
      {
        workerData: {
          initial: i * countRange + 1,
          final: (i + 1) * countRange,
        },
      }
    );

    const atualCount = countWorkers;
    worker.on("message", (message) => {
      console.log(`Worker ${stringifyNumber(atualCount)} message: ${message}`);
    });

    metaWorkers.push(worker);
  }

  for (const worker of metaWorkers) {
    await new Promise((resolve) =>
      worker.on("exit", (code) => {
        console.log(`Worker exited with code ${code}`);
        worker.terminate();
        resolve(code);
      })
    );
  }
};
