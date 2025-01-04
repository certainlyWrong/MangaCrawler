import { Worker } from "worker_threads";
import path from "path";
import chalk from "chalk";
import { stringifyNumber } from "../common/stringfy_number";
import { MongoClient } from "mongodb";

export const getCapsCommand = async (
  countThreads: number = 5
) => {
  const username = "root";
  const password = "1234";
  const host = "localhost";
  const port = 27017;
  const dbName = "flowermanga";
  const url = `mongodb://${username}:${password}@${host}:${port}`;
  const client = new MongoClient(url);
  await client.connect();

  const metaCollection = client.db(dbName).collection("metas");
  const mangaIds = (
    await metaCollection
      .find({}, { projection: { mangaId: 1, _id: 0 } })
      .toArray()
  ).map(meta => meta.mangaId.toString())

  const metaWorkers: Worker[] = [];

  console.log(
    chalk.yellow(
      `Processing ${mangaIds.length} mangasIds || ${countThreads} threads`
    )
  );

  const chunkMangaIds = (mangaIds: string[], size: number) => {
    const chunked_arr = [];
    let index = 0;
    while (index < mangaIds.length) {
      chunked_arr.push(mangaIds.slice(index, size + index));
      index += size;
    }
    return chunked_arr;
  };

  let chunks = chunkMangaIds(mangaIds, Math.floor(mangaIds.length / countThreads));

  for (let i = 0; i < chunks.length; i++) {
    const worker = new Worker(
      path.join(__dirname, "../workers", "cap_worker.ts"),
      {
        workerData: {
          mangaIds: chunks[i],
        },
      }
    );

    const atualCount = i + 1;
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

    client.close();
  }
};
