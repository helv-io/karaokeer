import exec from '@simplyhexagonal/exec'
import { Response } from 'express'
import fs from 'fs/promises'
import * as Genius from 'genius-lyrics'
import path from 'path'
import sanitize from 'sanitize-filename'
import streamToPromise from 'stream-to-promise'
import ytdl from 'ytdl-core'
import { GeniusLyrics } from 'genius-discord-lyrics'
import { ignorePromiseErrors } from './index'
import { Job, Jobs } from './Job'
import { Align } from './align'
import os from 'os'

const client = new Genius.Client(process.env.GENIUS_API || '')
const genius = new GeniusLyrics(process.env.GENIUS_API || '')

export const GeniusSearch = async (query: string, maxResults: number) => {
  try {
    const results = await client.songs.search(query, { sanitizeQuery: true })
    return results.slice(0, maxResults).map((song) => {
      return {
        id: song.id.toString(),
        type: 'genius',
        views: <number>song._raw?.stats?.pageviews || null,
        title: song.title,
        artist: song.artist.name,
        titleImage: song.image || null,
        authorImage: song.artist.image || null,
        duration: <string>song._raw?.duration || null,
        created: <string>song._raw?.release_date_for_display || null
      }
    })
  } catch (error) {
    console.error(error)
  }
}

export const getGeniusSong = async (
  geniusId: string | string,
  res: Response
) => {
  // Avoid processing same ID
  if (Jobs.find((j) => j.id === geniusId)) {
    res.redirect(`/status/${geniusId}`)
    return
  }

  const output: string = process.env.KARAOKE_OUTPUT || '/media/karaoke'
  const geniusApi = process.env.GENIUS_API || ''
  const header = new Headers({ Authorization: `Bearer ${geniusApi}` })
  let isJoined: boolean = false
  let isAligned: boolean = false
  const job = new Job(geniusId)

  try {
    // Get Track information from Genius and extract Artist, Song and URL
    const geniusResponse = await (await fetch(
      `https://api.genius.com/songs/${geniusId}`, { headers: header }
    )).json()

    // Reject invalid requests
    if (geniusResponse.meta.status !== 200) {
      res.status(geniusResponse.meta.status)
      switch (geniusResponse.meta.status) {
        case 401:
          res.end(
            `Genius API Key is Invalid: ${geniusApi}\nPlease provide a valid key through env var GENIUS_API`
          )
          break
        case 404:
          res.end(`Song with ID ${geniusId} not found.`)
          break
        default:
          res.end(geniusResponse)
      }
      return
    }
    const track = geniusResponse.response.song
    const youtube = track.media.find(
      (m: { provider: string; url: string }) => m.provider === 'youtube'
    )
    let artist: string = track.primary_artist.name
    let song: string = track.title
    if (!youtube) {
      res
        .status(406)
        .end(
          `No YouTube link available for ${artist} - ${song}. Unable to continue.`
        )
      return
    }

    // Exit functions
    const success = async () => {
      if (isAligned && isJoined) {
        console.log('All done!')
        await Promise.all(
          [
            fs.unlink(videoFile),
            fs.unlink(vocalsFile),
            fs.unlink(instrumentsFile),
            fs.unlink(audioFile)
          ].map(ignorePromiseErrors)
        )
        job.finishedOn = new Date(Date.now())
        job.success = true
        job.status = 'Done'
        job.sync()
      }
    }

    const failure = async (status: string) => {
      console.log('All done!')
      await Promise.all(
        [
          fs.unlink(videoFile),
          fs.unlink(audioFile),
          fs.unlink(vocalsFile),
          fs.unlink(instrumentsFile),
          fs.unlink(assFile),
          fs.unlink(karaokeFile)
        ].map(ignorePromiseErrors)
      )
      job.finishedOn = new Date(Date.now())
      job.success = false
      job.status = status
      job.sync()
    }

    // All prerequisites look good
    console.log(`Starting to process ${artist} - ${song}`)

    artist = sanitize(artist, { replacement: '_' }).replaceAll('-', '_')
    song = sanitize(song, { replacement: '_' }).replaceAll('-', '_')

    // Push Job instance and return to browser
    job.name = `${artist} - ${song}`
    Jobs.push(job)
    res.redirect(`/status/${geniusId}`)

    // Downloading lyrics
    console.log('Fetching Lyrics')
    const lyrics = (<string>(await genius.fetchLyrics(job.name)) || '').replaceAll('\n', '\r\n')
    if (!lyrics) {
      failure('Lyrics not found')
      return
    }
    console.log('Lyrics Found')

    // All file names
    const videoFile = path.join(os.tmpdir(), `${artist} - ${song}.mov`)
    const audioFile = path.join(os.tmpdir(), `${artist} - ${song}.webm`)
    const assFile = path.join(output, `${artist} - ${song}.ass`)
    const karaokeFile = path.join(output, `${artist} - ${song}.mp4`)
    const vocalsFile = path.join(os.tmpdir(), `${artist} - ${song} vocals.mp3`)
    const instrumentsFile = path.join(os.tmpdir(), `${artist} - ${song} accompaniment.mp3`)

    // Download all base files
    console.log('Downloading Video')
    await fs.writeFile(
      videoFile,
      await streamToPromise(
        ytdl(youtube.url, { quality: 'highest', filter: 'videoonly' })
      )
    )
    console.log('Downloading Audio')
    await fs.writeFile(
      audioFile,
      await streamToPromise(
        ytdl(youtube.url, { quality: 'highest', filter: 'audioonly' })
      )
    )

    console.log('Splitting Instruments and Vocals')

    // Use spleeter if available, otherwise fall back to (slow) vocal-remover
    // If using vocal-remover, move files to what they're expected to be.
    const split = `spleeter \
                  separate -o "${os.tmpdir()}" \
                  -c mp3 \
                  -f "{filename} {instrument}.{codec}" \
                  "${audioFile}" \
                  || \
                  (cd /vocal-remover && \
                    python /vocal-remover/inference.py -i "${audioFile}" -o "${os.tmpdir()}" && \
                    mv "${path.join(os.tmpdir(), `${artist} - ${song}_Vocals.wav`)}" "${vocalsFile}" && \
                    mv "${path.join(os.tmpdir(), `${artist} - ${song}_Instruments.wav`)}" "${instrumentsFile}"
                  )`

    exec(split).execPromise.then(async (_splitRes) => {
      console.log('Joining Video and Audio tracks')
      const join = `ffmpeg \
                  -i "${videoFile}" \
                  -i "${instrumentsFile}" \
                  -i "${vocalsFile}" \
                  -i "${audioFile}" \
                  -map 0:v -map 1:a -map 2:a -map 3:a \
                  -map_metadata -1 \
                  -metadata:s:a:0 Title=Instruments \
                  -metadata:s:a:1 Title=Vocals \
                  -metadata:s:a:2 Title=All \
                  -c:v copy -c:a aac \
                  -y "${karaokeFile}"`
      exec(join).execPromise.then(async (_joinRes) => {
        console.log('Video and Audio Joined Successfully!')
        isJoined = true
        success()
      })
    })

    console.log('Aligning Lyrics')
    const alignRes = await Align(lyrics, audioFile, job.name)
    if (alignRes.length < 500) {
      failure('Alignment failed. Please check the logs.')
      job.success = false
      return
    }
    isAligned = true
    await fs.writeFile(assFile, alignRes)
    await success()
  } catch (error) {
    job.finishedOn = new Date(Date.now())
    job.status = JSON.stringify(error)
    job.success = false
    job.sync()
    console.error(error)
  }
}
