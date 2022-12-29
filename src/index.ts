import express from 'express'
import path from 'path'
import { GeniusSearch, getGeniusSong } from './GeniusHandler'
import { Jobs } from './Job'
import { YTDownload, YTSearch } from './YouTubeHandler'
const align = require('./align')

const app = express();

(async () => {
  console.log(`
=============
= Karaokeer =
=============

Starting service...`)

  // Routes
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '/index.html')))
  app.get('/version', (_req, res) =>
    res
      .status(200)
      .send(
        `${process.env.npm_package_name} ${process.env.npm_package_version}`
      )
  )
  app.post('/align', align.index)
  app.get('/genius/:id', (req, res) => {
    getGeniusSong(req.params.id, res)
  })
  app.get('/youtube/:id', (req, res) => {
    YTDownload(req.params.id, res)
  })
  app.get('/status', (_req, res) => res.json(Jobs).end())
  app.get('/status/:id', (req, res) =>
    res
      .json(Jobs.find((job) => job.id.toString() === req.params.id) || {})
      .end()
  )
  app.get('/search/:query', async (req, res) => {
    const query = req.params.query
    const results = 5
    let songs = await Promise.all([GeniusSearch(query, results), YTSearch(query, results)])
    if (!songs[0]?.length) {
      res.json(songs[1])
      return
    }
    if (!songs[1]?.length) {
      res.json(songs[0])
      return
    }
    songs[1].forEach((song) => {
      songs[0]?.push(song)
    })
    res.json(songs[0])
  })

  app.listen(3000, async () => {
    console.log('✔ Listening on port 3000!')
  })
})()

export const ignorePromiseErrors = (promise: Promise<any>) => {
  return promise.catch((_e) => undefined)
}
