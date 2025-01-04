import { MongoClient } from "mongodb";
import { workerData, parentPort } from "worker_threads";
import {
  NavigationController,
  type Card,
  type Meta,
} from "../controllers/navegation_controller";
import chalk from "chalk";
import { stringifyNumber } from "../common/stringfy_number";

interface FullMeta {
  meta: Meta;
  card: Card;
  atualPage: number;
  chapterCount: number;
}

const crawlerFullMeta = async function* (
  initial: number,
  final: number
): AsyncGenerator<FullMeta, void, void> {
  const navigationController = new NavigationController();
  await navigationController.load();

  for (let i = initial; i <= final; i++) {
    try {
      const cardPage = await navigationController.open(
        `https://flowermanga.net/manga/page/${i}/`
      );
      const elementCards = await navigationController.getCards(cardPage);
      await cardPage.close();

      let chapterCount = 0;
      for (const elementCard of elementCards) {
        const metaPage = await navigationController.open(elementCard.link);
        const meta = await navigationController.getMeta(metaPage);
        await metaPage.close();

        chapterCount++;

        yield { meta, card: elementCard, atualPage: i, chapterCount };
      }
    } catch (error) {
      console.log(
        chalk.red(`Error on page ${stringifyNumber(i)}, trying again`)
      );
      i--;
    }
  }
  await navigationController.close();
};

const run = async () => {
  const username = "root";
  const password = "1234";
  const host = "localhost";
  const port = 27017;
  const dbName = "flowermanga";
  const url = `mongodb://${username}:${password}@${host}:${port}`;
  const client = new MongoClient(url);
  await client.connect();

  if (workerData && parentPort) {
    const generator = crawlerFullMeta(workerData.initial, workerData.final);
    console.log(
      chalk.yellow(
        `Processing cards from ${workerData.initial} to ${workerData.final}`
      )
    );

    let count = workerData.initial;

    const db = client.db(dbName);

    for await (const result of generator) {
      try {
        const cardsCollection = db.collection("cards");
        const insertion = await cardsCollection.insertOne(result.card);

        const metasCollection = db.collection("metas");
        await metasCollection.insertOne({
          ...result.meta,
          mangaId: insertion.insertedId,
        });
        count++;

        parentPort.postMessage(
          `Page ${stringifyNumber(result.atualPage)} of ${stringifyNumber(
            workerData.final
          )} ||| ${stringifyNumber(result.chapterCount)} |||` +
            chalk.green(` ${result.card.title}`)
        );
      } catch (error) {
        console.log(error);
      }
    }
    parentPort.postMessage(`Total of ${count} cards processed}`);
    parentPort.close();
  }
  await client.close();
};

run();
