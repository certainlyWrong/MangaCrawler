import { MongoClient, ObjectId } from "mongodb";
import { workerData, parentPort } from "worker_threads";
import {
  NavigationController,
  type Cap,
} from "../controllers/navegation_controller";
import chalk from "chalk";
import { stringifyNumber } from "../common/stringfy_number";

interface FullCap {
  cap: Cap;
  totalCaps: number;
  countMeta: number;
  mangaId: string;
}

export const crawlerCaps = async function* (
  mangaIds: string[],
): AsyncGenerator<FullCap, void, void> {
  const navigationController = new NavigationController();
  await navigationController.load();

  const username = "root";
  const password = "1234";
  const host = "localhost";
  const port = 27017;
  const dbName = "flowermanga";
  const url = `mongodb://${username}:${password}@${host}:${port}`;
  const client = new MongoClient(url);
  await client.connect();

  const metaCollection = client.db(dbName).collection("metas");
  const metas = await metaCollection.find(
    {
      mangaId: {
        $in: mangaIds.map(
          (mangaId) => new ObjectId(mangaId)
        )

      }
    }
  )
    .toArray()

  let metaCount = 0;
  for (let i = 0; i < metas.length; i++) {
    metaCount++;

    const filterChapterLinks = (chapterLinks: string[]) => {
      const auxChapters = chapterLinks.sort((a, b) => {
        const capA = a.match(/capitulo-(\d+)/);
        const capB = b.match(/capitulo-(\d+)/);

        if (capA && capB) {
          return parseInt(capA[1]) - parseInt(capB[1]);
        }

        return 0;
      });

      if (auxChapters.length > 20) {
        return auxChapters.slice(0, 20);
      }

      return auxChapters;
    }

    const chapterLinks = filterChapterLinks(metas[i].chapterLinks as string[]);

    try {
      for (let j = 0; j < chapterLinks.length; j++) {
        try {
          const cardPage = await navigationController.open(
            chapterLinks[j]
          );

          const elementsCap = await navigationController.getChapters(cardPage, stringifyNumber(j));
          await cardPage.close();
          yield { cap: elementsCap, mangaId: metas[i].mangaId, totalCaps: chapterLinks.length, countMeta: metaCount };
        } catch (error) {
          j--
          console.log(
            chalk.red(`Error crawling cap ${stringifyNumber(j)} of manga ${metas[i].mangaId}, trying again`),
          );
        }
      }
    } catch (error) {
      console.log(
        chalk.red(`Error on parsing page ${stringifyNumber(i)}`)
      );
    }

  }
  await navigationController.close();
  await client.close();
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
    const generator = crawlerCaps(workerData.mangaIds);

    const db = client.db(dbName);

    for await (const result of generator) {
      try {
        const chaptersCollection = db.collection("chapters");
        await chaptersCollection.insertOne({ ...result.cap, mangaId: result.mangaId });

        parentPort.postMessage(
          chalk.green(
            `Caps ${result.cap.number} of ${stringifyNumber(result.totalCaps)} ||| metaCount: ${result.countMeta} of ${workerData.mangaIds.length}`,
          )
        );
      } catch (error) {
        console.log(error);
      }
    }
    parentPort.postMessage(`Total of ${workerData.mangaIds.length} cards processed}`);
    parentPort.close();
  }
  await client.close();
};

run();
