import LyricsSearcher from 'lyrics-searcher'
import fs from 'fs'
import ytdl from 'ytdl-core'
import path from 'path'
import streamToPromise from 'stream-to-promise'
import exec from '@simplyhexagonal/exec'
import { Axios, AxiosRequestConfig } from 'axios'
import FormData from 'form-data'

export const getGeniusSong = async function (geniusId: number, output: string = '/media/karaoke') {
  const geniusApi = process.env.GENIUS_API || ''
  const header: AxiosRequestConfig = { headers: {'Authorization': `Bearer ${geniusApi}`} }
  const axios = new Axios(header)

  try {
    // Get Track information from Genius and extract Artist, Song and URL
    const track = JSON.parse((await axios.get(`https://api.genius.com/songs/${geniusId}`)).data).response.song
    const artist = track.album.artist.name
    const song = track.title
    const url = track.media.find((m: { provider: string, url: string }) => m.provider === 'youtube').url
  
    // All file names
    const videoFile = path.join(output, `${artist} - ${song}.mov`)
    const audioFile = path.join(output, `${artist} - ${song}.webm`)
    const assFile = path.join(output, `${artist} - ${song}.ass`)
    const karaokeFile = path.join(output, `${artist} - ${song}.mp4`)
    const vocalsFile = path.join(output, `${artist} - ${song} vocals.mp3`)
    const instrumentsFile = path.join(output, `${artist} - ${song} accompaniment.mp3`)
  
    // Download all base files
    console.log('Downloading Video from YouTube')
    await fs.writeFileSync(videoFile, await streamToPromise(ytdl(url, { quality: 'highest', filter: 'videoonly' })))

    console.log('Downloading Audio from YouTube')
    await fs.writeFileSync(audioFile, await streamToPromise(ytdl(url, { quality: 'highest', filter: 'audioonly' })))

    console.log('Downloading Lyrics')
    const lyrics = (await LyricsSearcher(artist, song)).replaceAll('\n', '\r\n')

    console.log('Splitting Instruments and Vocals')
    {
      const cmd = `spleeter separate -o "${output}" -c mp3 -f "{filename} {instrument}.{codec}" "${audioFile}"`
      const { execProcess, execPromise } = exec(cmd)
      console.log(await execPromise)
    }
  
    console.log('Joining Video, Audio and Lyrics')
    {
      const cmd = `ffmpeg \
                  -i "${videoFile}" \
                  -i "${instrumentsFile}" \
                  -i "${vocalsFile}" \
                  -i "${audioFile}" \
                  -map 0:v -map 1:a -map 2:a -map 3:a \
                  -map_metadata -1 \
                  -metadata:s:a:0 Title=Instruments \
                  -metadata:s:a:1 Title=Vocals \
                  -metadata:s:a:2 Title=All  \
                  -c:v copy -c:a aac \
                  -y "${karaokeFile}"`
      const { execProcess, execPromise } = exec(cmd)
      console.log(await execPromise)
    }

    console.log('Aligning Lyrics')
    const form = new FormData()
    form.append('audio_file', fs.createReadStream(audioFile), `${artist} - ${song}.webm`)
    form.append('lyrics', lyrics)
    form.append('format', 'ass')
    fs.writeFileSync(assFile, (await axios.post('http://127.0.0.1:3000/align', form)).data)

    console.log('Deleting unecessary files')
    fs.unlinkSync(videoFile)
    fs.unlinkSync(audioFile)
    fs.unlinkSync(vocalsFile)
    fs.unlinkSync(instrumentsFile)

    console.log('All done!')
  } catch (e) {
    console.error(e)
  }
}

getGeniusSong(1063)