import { sleep } from "bun";
import { Database } from "bun:sqlite";
import chalk from "chalk";
import { MongoClient } from "mongodb";


export const saveSqliteCommand = async (
  sqlitePathSave: string,
) => {
  const username = 'root'
  const password = '1234'
  const host = 'localhost'
  const port = 27017
  const dbName = 'flowermanga'
  const url = `mongodb://${username}:${password}@${host}:${port}`
  const client = new MongoClient(url)
  await client.connect()


  const db = new Database(sqlitePathSave);

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS genre (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
    `,
  )

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS manga_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
    `,
  )

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS card (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image TEXT NOT NULL
    )
    `,
  )

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      highImage TEXT NOT NULL,
      available TEXT NOT NULL,
      mangaId INTEGER NOT NULL,
      alternative TEXT,
      manga_typeId INTEGER NOT NULL,
      status TEXT NOT NULL,
      resume TEXT,
      FOREIGN KEY (mangaId) REFERENCES card(id),
      FOREIGN KEY (manga_typeId) REFERENCES manga_type(id)
    )
    `,
  )

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS meta_genre (
      mangaId INTEGER NOT NULL,
      genreId INTEGER NOT NULL,
      PRIMARY KEY (mangaId, genreId),
      FOREIGN KEY (mangaId) REFERENCES card(id),
      FOREIGN KEY (genreId) REFERENCES genre(id)
    );
    `,
  )

  db.exec(
    `
    CREATE TABLE IF NOT EXISTS chapter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      link TEXT NOT NULL,
      mangaId INTEGER NOT NULL,
      FOREIGN KEY (mangaId) REFERENCES card(id)
    )
    `,
  )


  type GenreRow = { id: number }

  const getOrCreateMangaTypeId = (mangaType: string): number => {
    const stmt = db.prepare('SELECT id FROM manga_type WHERE name = ?')
    const typeRow = stmt.get(mangaType) as GenreRow | undefined

    if (typeRow) {
      return typeRow.id
    }

    console.log(
      chalk.green(`Inserindo mangaType ${mangaType} na tabela manga_type`),
    )

    const insertStmt = db.prepare('INSERT INTO manga_type (name) VALUES (?)')
    const result = insertStmt.run(mangaType)
    return result.lastInsertRowid as number
  }

  // Inserções
  try {
    const collectionCards = client.db(dbName).collection('cards')
    const allCards = await collectionCards.find({}).toArray()

    const insertCard = db.prepare(
      'INSERT INTO card (title, image) VALUES (?, ?)',
    )

    const insertMeta = db.prepare(
      'INSERT INTO meta (highImage, available, mangaId, alternative, manga_typeId, status, resume) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )

    const insertGenreStmt = db.prepare(
      'INSERT INTO genre (name) VALUES (?)',
    )

    const getGenreIdStmt = db.prepare('SELECT id FROM genre WHERE name = ?')

    const insertMetaGenre = db.prepare(
      'INSERT INTO meta_genre (mangaId, genreId) VALUES (?, ?)',
    )

    const insertChapter = db.prepare(
      'INSERT INTO chapter (number, link, mangaId) VALUES (?, ?, ?)',
    )

    for (const card of allCards) {
      const cardResult = insertCard.run(card.title, card.lowImage)

      const collectionMetas = client.db(dbName).collection('metas')
      const meta = await collectionMetas.findOne({ mangaId: card._id })

      const mangaTypeId = getOrCreateMangaTypeId(meta?.mangaType)
      const metaResult = insertMeta.run(
        meta?.highImage || '',
        meta?.available,
        cardResult.lastInsertRowid,
        meta?.alternative,
        mangaTypeId,
        meta?.status,
        meta?.resume,
      )

      console.log(
        chalk.green(
          `Meta inserido com sucesso para o card ${card.title} (Manga ID: ${metaResult.lastInsertRowid})`,
        ),
      )

      const genres = meta?.genres || []
      for (const genreName of genres) {
        let genreId = (getGenreIdStmt.get(genreName) as GenreRow | undefined)
          ?.id
        if (!genreId) {
          const genreResult = insertGenreStmt.run(genreName)
          genreId = genreResult.lastInsertRowid as number
        }

        insertMetaGenre.run(metaResult.lastInsertRowid, genreId)
      }

      const collectionChapters = client.db(dbName).collection('chapters')
      const allChapters = await collectionChapters
        .find({ mangaId: card._id })
        .toArray()

      for (const chapter of allChapters) {
        console.log(
          chalk.green(
            `Inserindo capítulo ${chapter.number} para o card ${card.title}`,
          ),
        );
        for (const link of chapter.links as string[]) {
          insertChapter.run(chapter.number, link, cardResult.lastInsertRowid)
        }
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    await client.close()
    db.close()
  }
}