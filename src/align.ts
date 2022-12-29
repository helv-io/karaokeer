import { transliterate } from "transliteration"
import fs from 'fs/promises'
import os from 'os'
import { exec, ExecOptions } from "child_process"
import dayjs from "dayjs"
import sanitize from "sanitize-filename"

export const Align = async (lyrics: string, audioPath: string, baseName: string = crypto.randomUUID()) => {
    baseName = sanitize(baseName).replaceAll(' ', '')
    if (!lyrics || !audioPath)
        return ''

    console.log('Cleaning lyrics...')
    lyrics = lyrics.replace(/^\[.*\][\r\n]/mg, '') //remove song part identifier lines like [Chorus]
    lyrics = lyrics.replace(/\*[^\n\r]+\*/mg, ' ') //remove things like *breathes*
    lyrics = lyrics.replace(/\([^\n\r\)]+\)/mg, ' ') //remove things like (woo)
    lyrics = lyrics.replace(/\s/mg, ' ') //change all white-space characters to a normal space
    lyrics = lyrics.replace(/\p{Pd}+/mg, ' ') //replace dashes, hyphens, etc with a space
    lyrics = lyrics.replace(/`/mg, '\'') //replace backtick with single quote
    lyrics = lyrics.replace(/&/mg, 'and') //replace ampersand with "and"
    lyrics = lyrics.replace(/[\r\n]+/mg, ' ') //replace newlines with a space
    lyrics = transliterate(lyrics) //convert all characters to romanized ASCII (including special quote characters)
    lyrics = lyrics.replace(/[^a-zA-Z0-9' ]+/mg, ' ') //remove anything that isn't an alphanumeric character or single quote
    lyrics = lyrics.replace(/ +/mg, ' ') //collapse multiple spaces into one
    lyrics = lyrics.trim() //trim spaces

    try {
        const lyricsFile = `${os.tmpdir()}/${baseName}.txt`
        const alignedFile = `${os.tmpdir()}/${baseName}_aligned.txt`
        const audioFile = `${os.tmpdir()}/${baseName}.webm`
        await fs.writeFile(lyricsFile, lyrics)
        await fs.copyFile(audioPath, audioFile)

        console.log('Aligning Lyrics (this will take a while)...')
        const cmd = `./RunAlignment.sh ${audioFile} ${lyricsFile} ${alignedFile}`
        console.log(cmd)
        await promisifiedExec(cmd, { cwd: '/NUSAutoLyrixAlign/' })

        // Check if aligned file exists, return false if not
        if (!await fs.access(alignedFile, fs.constants.F_OK).then(() => true).catch(() => false)) {
            console.log(`File ${alignedFile} does not exist. Alignment failed.`)
            return ''
        }
        const alignedLyrics = (await fs.readFile(alignedFile)).toString()
        console.log(`Aligned lyrics:\n${alignedLyrics}`)
        if (alignedLyrics.length < 50) {
            console.log(`File ${alignedFile} is too small. Alignment failed.`)
            return ''
        }
        const jsonLyrics = compileJson(lyrics, alignedLyrics)
        const assLyrics = compileAss(jsonLyrics)
        return assLyrics
    } catch (error) {
        return ''
    }
}

const promisifiedExec = (cmd: string, options: ExecOptions = {}) => {
    return new Promise((resolve, reject) => {
        if (!options['env']) options.env = process.env
        exec(cmd, options, (error, stdout) => {
            if (error) {
                console.error(error)
                reject(error)
            }
            resolve(stdout)
        })
    })
}

const compileJson = (original: string, aligned: string) => {
    const aligned_text_array = aligned.trim().split(/\r\n|\r|\n/) //turn aligned text into a more easily accessible array by index
    let aligned_word_count = 0
    let song_start: number | undefined
    let song_end: number | undefined
    let results: { word?: string, processed_words?: string, start?: number, end?: number, ignore?: boolean }[][] = []
    let compiled_line: { word?: string, processed_words?: string, start?: number, end?: number, ignore?: boolean }[]
    original = original.replace(/`/mg, '\'') //replace backtick with single quote
    original = original.replace(/\n\s*\n/g, '\n') //replace multiple line breaks with one
    const lines = original.split(/\r\n|\r|\n/) //split into array of lines
    lines.forEach(line => {
        compiled_line = [{}]
        line = line.replace(/\s/mg, ' ') //change all white-space characters to a normal space
        line = line.replace(/ +/mg, ' ') //collapse multiple spaces into one
        line = line.trim()

        //if this is an empty line, skip it...
        if (line == '') {
            results.push(compiled_line)
            return
        }

        //if this is a song part identifier line like [Chorus], skip it...
        if (line.match(/^\[.*\]$/) !== null) {
            compiled_line.push({
                word: line,
                processed_words: '',
                ignore: true
            })
            results.push(compiled_line)
            return
        }

        //split by spaces or things like *breathes* or (woo woo), with the delimiters included in the results...                
        let words = line.split(/(\*.+\*|\([^\)\n\r]+\)| )/)
        words.forEach(word => {
            word = word.trim()

            //if the word is empty, skip it completely...
            if (word == '') {
                return
            }

            //if this is something like *breathes* or (woo), include it in the results with no timestamp...
            if (word.match(/\*.+\*|\([^\)\n\r]+\)/) !== null) {
                compiled_line.push({
                    word: word,
                    processed_words: '',
                    ignore: true
                })
                return
            }

            //this word could have ended up containing multiple aligned words...
            let start: number | undefined
            let end: number | undefined
            let processed_words = ''
            let ignore = true
            let aligned_line = word.replace(/\p{Pd}+/g, ' ') //replace dashes, hyphens, etc with a space
            aligned_line = aligned_line.replace(/&/mg, 'and') //replace ampersand with "and"
            aligned_line = transliterate(aligned_line) //convert all characters to romanized ASCII (including special quote characters). this can also introduce new spaces
            aligned_line = aligned_line.replace(/[^a-zA-Z0-9' ]+/g, ' ') //remove anything that isn't an alphanumeric character or single quote
            aligned_line = aligned_line.replace(/ +/mg, ' ') //collapse multiple spaces into one
            aligned_line = aligned_line.trim() //punctuation will be turned into spaces, so need to trim that now
            const aligned_words = aligned_line.split(' ') //split by spaces
            aligned_words.forEach(aligned_word => {
                aligned_word = aligned_word.trim() //shouldn't be necessary, but just in case
                if (aligned_word !== '') {
                    if (aligned_word_count >= aligned_text_array.length) {
                        throw new Error('Could not compile results. We\'ve somehow gone over the raw word count of ' + aligned_text_array.length + ' at word ' + aligned_word)
                    }

                    let aligned_word_parts = aligned_text_array[aligned_word_count].split(' ') //get the start/end/word from the alignment data
                    processed_words = processed_words + aligned_word_parts[2].trim() + ' ' //tack this word onto the end of the compiled word result
                    if (!start) start = parseFloat(aligned_word_parts[0]) //if we haven't gotten the start time yet, this is the first aligned word, and this is the start time
                    end = parseFloat(aligned_word_parts[1]) //keep updating the end time, so the last aligned word's end time will be used
                    ignore = false
                    aligned_word_count++
                }
            })

            //keep track of the song's start and end times...
            if (!song_start && start) song_start = start
            if (end) song_end = end

            compiled_line.push({
                word,
                processed_words: processed_words.trim(),
                start,
                end,
                ignore
            })
        })

        results.push(compiled_line)
    })

    //go back and fill in missing times. start by making sure we have valid start/end song times...
    if (!song_start) song_start = 0
    if (!song_end) song_end = song_start

    //fill in missing starts by going from start to finish...
    let prev_end: number | undefined = song_start
    for (let line_x = 0; line_x < results.length; line_x++) {
        for (let word_x = 0; word_x < results[line_x].length; word_x++) {
            if (results[line_x][word_x].start === null) results[line_x][word_x].start = prev_end
            if (results[line_x][word_x].end !== null) prev_end = results[line_x][word_x].end
        }
    }

    //fill in missing ends by going from finish to start...
    let prev_start: number | undefined = song_end
    for (let line_x = results.length - 1; line_x >= 0; line_x--) {
        for (let word_x = results[line_x].length - 1; word_x >= 0; word_x--) {
            if (results[line_x][word_x].end === null) results[line_x][word_x].end = prev_start
            if (results[line_x][word_x].start !== null) prev_start = results[line_x][word_x].start
        }
    }

    if (aligned_word_count != aligned_text_array.length) {
        throw new Error('Could not compile results. The aligned word count (' + aligned_word_count + ') does not match the raw word count (' + aligned_text_array.length + ')')
    }

    return results
}

const compileAss = (lyrics: {
    word?: string | undefined;
    processed_words?: string | undefined;
    start?: number | undefined;
    end?: number | undefined;
    ignore?: boolean | undefined;
}[][]) => {
    lyrics = lyrics.filter(line => line[0].word != '')
    const assHead = `
[Script Info]
Title: Lyrics
Original Script: AutoLyricsAlign
ScriptType: v4.00+
Collisions: Normal
Timer: 100.0000
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Tahoma,24,&H00FF00FF,&H00000000,&H00FFFFFF,&HFF000000,-1,0,0,0,100,100,0,0,1,2,3,5,30,30,10,1

[Events]
Format: Layer, Start, End, Style, Actor, MarginL, MarginR, MarginV, Effect, Text
`.trim()

    let lines = []
    lines.push(assHead)
    lyrics.forEach((line, index, arr) => {
        const startOfVerse = line[0].start || 0
        const endOfVerse = line[line.length - 1].end || 0
        const offset = startOfVerse > 1 ? 100 : startOfVerse * 100
        const start = dayjs('1900-01-01').add(startOfVerse - (offset / 100), 'second').format('H:mm:ss.SSS').slice(0, -1)
        const end = dayjs('1900-01-01').add(endOfVerse, 'second').format('H:mm:ss.SSS').slice(0, -1)
        let verse = `Dialogue: 0,${start},${end},Default,,0000,0000,0000,,{\\K${offset}}`

        if (index < lyrics.length - 5) {
            const startOfNextVerse = arr[index + 1][0].start || 0
            const gap = startOfNextVerse - endOfVerse
            if (gap >= 4) {
                const gapStart = dayjs('1900-01-01').add(startOfNextVerse - 5, 'second').format('H:mm:ss.SSS').slice(0, -1)
                const gapEnd = dayjs('1900-01-01').add(startOfNextVerse, 'second').format('H:mm:ss.SSS').slice(0, -1)
                lines.push(`Dialogue: 0,${gapStart},${gapEnd},Default,,0000,0000,0000,,{\\K500}🎵🎵🎵🎵🎵`)
            }
        }

        line.forEach(word => {
            const duration = Math.round(word.end || 0 * 100) - Math.round(word.start || 0 * 100)
            if (duration) {
                verse += `{\\K${duration}}${word.word}{\\K0} `
            } else {
                verse += `${word.word} `
            }
        })
        lines.push(verse)
    })
    return lines.join('\r\n')
}