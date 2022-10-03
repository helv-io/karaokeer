import YouTubeSearch from 'ytsr'
import ytdl from 'ytdl-core'
import streamToPromise from 'stream-to-promise'
import exec from '@simplyhexagonal/exec'
import fs from 'fs/promises'
import { Response } from 'express'
import path from 'path'

export const YTSearch = async (query: string, res: Response) => {
  try {
    res.status(200).json(await YouTubeSearch(query))
  } catch (error) {
    console.error(error)
    res.json(error).end()
  }
}

export const YTDownload = async (id: string, res: Response) => {
    try {
        const output: string = process.env.KARAOKE_OUTPUT || '/media/karaoke'
        const youtube = await ytdl.getInfo(id)
        const artist = youtube.player_response.videoDetails.author
        const song = youtube.player_response.videoDetails.title
        const videoFile = path.join(output, `${artist} - ${song}.mov`)
        const audioFile = path.join(output, `${artist} - ${song}.webm`)
        const karaokeFile = path.join(output, `${song}.mp4`)

        // Download all base files
        console.log('Downloading Video')
        await fs.writeFile(videoFile, await streamToPromise(ytdl(id, { quality: 'highest', filter: 'videoonly' })))
        console.log('Downloading Audio')
        await fs.writeFile(audioFile, await streamToPromise(ytdl(id, { quality: 'highest', filter: 'audioonly' })))
        console.log('Joining Video and Audio tracks')
        const cmd = `ffmpeg \
                    -i "${videoFile}" \
                    -i "${audioFile}" \
                    -map 0:v -map 1:a \
                    -map_metadata -1 \
                    -metadata:s:a:0 Title=Instruments \
                    -c:v copy -c:a aac \
                    -y "${karaokeFile}"`
        const { execProcess, execPromise } = exec(cmd)
        await execPromise
        await fs.unlink(videoFile)
        await fs.unlink(audioFile)
        res.status(200).end(`${artist} - ${song} downloaded successfully!`)
    } catch (error) {
        console.error(error)
        res.status(500).json(error).end()
    }
}