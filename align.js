const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const dayjs = require('dayjs')
const { exec } = require('child_process')
const { transliterate } = require('transliteration')

async function index(req, res)
{
	//used to quickly debug an existing tmp folder with already aligned lyrics...
	// const debug_tmp_folder = 'gnSRiFzFnPoD8UZA'
	const debug_tmp_folder = false

	console.log('Received an alignment request!')
	res.setTimeout(10 * 3600 * 1000) //10 hours (in case we're stuck waiting in the queue)

	if (!req.files || Object.keys(req.files).length === 0 || !req.files['audio_file']) {
		return res.status(400).send('audio_file is required')
	}

	if (!req.body || Object.keys(req.body).length === 0 || !req.body['lyrics'] || !req.body.lyrics) {
		return res.status(400).send('lyrics are required')
	}

	let format = 'ass'
	if (req.body['format']) {
		if (!['raw', 'json', 'ass'].includes(req.body.format))
		return res.status(400).send('If included, format must be "raw", "json" or "ass".')
		format = req.body.format
	}

	//cleanup lyrics...
	console.log('Cleaning lyrics...')
	let lyrics = req.body.lyrics
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

	//make sure the lyrics still contain something...
	if (lyrics == '') { throw new Error('The cleaned up lyrics are empty') }

	//ready a new tmp folder...
	console.log('Moving lyrics and audio to a tmp folder...')
	let tmp_folder_name = ''
	let tmp_folder_path = ''
	do {
		tmp_folder_name = random_str()
		tmp_folder_path = path.join(__dirname, 'tmp', tmp_folder_name)
	} while (fs.existsSync(tmp_folder_path))

	//for quick debugging...
	if (debug_tmp_folder)
	{
		tmp_folder_name = debug_tmp_folder
		tmp_folder_path = path.join(__dirname, 'tmp', tmp_folder_name)
	}

	try
	{
		//attempt to create the new tmp folder...
		await fs.mkdirSync(tmp_folder_path, { recursive: true })

		//save lyrics to tmp file...
		fs.writeFileSync(path.join(tmp_folder_path, 'lyrics.txt'), lyrics)

		//move the audio file to the tmp folder...
		req.files.audio_file.mv(path.join(tmp_folder_path, req.files.audio_file.name))

		//if we're not quickly debugging an existing alignment...
		if (!debug_tmp_folder)
		{
			await process(tmp_folder_name, req.files.audio_file.name).catch((err) => { throw err })
		}

		//check that the alignment.txt file exists and is not empty...
		if (!fs.existsSync(path.join(tmp_folder_path, 'aligned.txt'))) throw new Error('Alignment appears to have failed. The aligned.txt file was not created.')
		if (fs.statSync(path.join(tmp_folder_path, 'aligned.txt')).size < 50) throw new Error('Alignment appears to have failed. The aligned.txt file is empty.')
		const aligned_text = fs.readFileSync(path.join(tmp_folder_path, 'aligned.txt'), 'utf8')
		if (aligned_text.length < 10) throw new Error('Alignment appears to have failed. The raw aligned text is empty.')

		//compile results...
		if (format == 'json')
		{
			console.log('Finished alignment successfully! Compiling to JSON...')
			const results = compile_json(req.body.lyrics, aligned_text)

			//remove tmp folder and return results...
			console.log('✔ Done!')
			if (!debug_tmp_folder) rimraf(tmp_folder_path, () => { })
			return res.status(200).json(results)
		}
		else if (format == 'ass')
		{
			console.log('Finished alignment successfully! Compiling to ASS...')
			let results = compile_json(req.body.lyrics, aligned_text)
			results = compile_ass(results)

			//remove tmp folder and return results...
			console.log('✔ Done!')
			if (!debug_tmp_folder) rimraf(tmp_folder_path, () => { })
			res.type('text/plain')
			return res.status(200).send(results)
		}
		{
			console.log('Finished alignment successfully!')

			//remove tmp folder and return raw results...
			console.log('✔ Done!')
			if (!debug_tmp_folder) rimraf(tmp_folder_path, () => { })
			return res.status(200).send(aligned_text)
		}
	}
	catch (err)
	{
		rimraf(tmp_folder_path, () => { })
		if (err && err['message']) {
			console.log(`✖ ${err.message}`)
			return res.status(400).send(err.message)
		} else {
			console.log('✖ An unexpected error occurred while aligning the lyrics')
			return res.status(400).send('An unexpected error occurred while aligning the lyrics')
		}
	}
}

function random_str(length = 16)
{
	var result = ''
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	var charactersLength = characters.length
	for (var i = 0; i < length; i++)
	{
		result += characters.charAt(Math.floor(Math.random() * charactersLength))
	}
	return result
}

function promisifiedExec(cmd, options = {})
{
	return new Promise((resolve, reject) =>
	{
		if (!options['env']) options.env = process.env

		const exec_process = exec(cmd, options, (error, stdout, stderr) =>
		{
			if (error)
			{
				reject(error)
			}
			resolve(stdout)
		})
	})
}

async function process(tmp_folder_name, audio_file_name)
{
	console.log('Aligning lyrics (this will take awhile)...')

	const cmd = './RunAlignment.sh ../tmp/' + tmp_folder_name + '/' + audio_file_name + ' ../tmp/' + tmp_folder_name + '/lyrics.txt ../tmp/' + tmp_folder_name + '/aligned.txt'

	await promisifiedExec(cmd, { cwd: '/NUSAutoLyrixAlign/'})
}

function compile_json(original_lyrics, aligned_text)
{
	const aligned_text_array = aligned_text.trim().split(/\r\n|\r|\n/) //turn aligned text into a more easily accessible array by index
	let aligned_word_count = 0
	let song_start = null
	let song_end = null
	let results = []
	let compiled_line = []
	let lines = original_lyrics
	lines = lines.replace(/`/mg, '\'') //replace backtick with single quote
	lines = lines.replace(/\n\s*\n/g, '\n') //replace multiple line breaks with one
	lines = lines.split(/\r\n|\r|\n/) //split into array of lines
	lines.forEach(line =>
	{
		compiled_line = []
		line = line.replace(/\s/mg, ' ') //change all white-space characters to a normal space
		line = line.replace(/ +/mg, ' ') //collapse multiple spaces into one
		line = line.trim()

		//if this is an empty line, skip it...
		if (line == '')
		{
			results.push(compiled_line)
			return
		}

		//if this is a song part identifier line like [Chorus], skip it...
		if (line.match(/^\[.*\]$/) !== null)
		{
			compiled_line.push({
				word: line,
				processed_words: '',
				start: null,
				end: null,
				ignore: true
			})
			results.push(compiled_line)
			return
		}

		//split by spaces or things like *breathes* or (woo woo), with the delimiters included in the results...
		let words = line.split(/(\*.+\*|\([^\)\n\r]+\)| )/)
		words.forEach(word =>
		{
			word = word.trim()

			//if the word is empty, skip it completely...
			if (word == '')
			{
				return
			}

			//if this is something like *breathes* or (woo), include it in the results with no timestamp...
			if (word.match(/\*.+\*|\([^\)\n\r]+\)/) !== null)
			{
				compiled_line.push({
					word: word,
					processed_words: '',
					start: null,
					end: null,
					ignore: true
				})
				return
			}

			//this word could have ended up containing multiple aligned words...
			let start = null
			let end = null
			let processed_words = ''
			let ignore = true
			let aligned_words = word.replace(/\p{Pd}+/g, ' ') //replace dashes, hyphens, etc with a space
			aligned_words = aligned_words.replace(/&/mg, 'and') //replace ampersand with "and"
			aligned_words = transliterate(aligned_words) //convert all characters to romanized ASCII (including special quote characters). this can also introduce new spaces
			aligned_words = aligned_words.replace(/[^a-zA-Z0-9' ]+/g, ' ') //remove anything that isn't an alphanumeric character or single quote
			aligned_words = aligned_words.replace(/ +/mg, ' ') //collapse multiple spaces into one
			aligned_words = aligned_words.trim() //punctuation will be turned into spaces, so need to trim that now
			aligned_words = aligned_words.split(' ') //split by spaces
			aligned_words.forEach(aligned_word =>
			{
				aligned_word = aligned_word.trim() //shouldn't be necessary, but just in case
				if (aligned_word !== '')
				{
					if (aligned_word_count >= aligned_text_array.length)
					{
						throw new Error('Could not compile results. We\'ve somehow gone over the raw word count of ' + aligned_text_array.length + ' at word ' + aligned_word)
					}

					let aligned_word_parts = aligned_text_array[aligned_word_count].split(' ') //get the start/end/word from the alignment data
					processed_words = processed_words + aligned_word_parts[2].trim() + ' ' //tack this word onto the end of the compiled word result
					if (start === null) start = parseFloat(aligned_word_parts[0]) //if we haven't gotten the start time yet, this is the first aligned word, and this is the start time
					end = parseFloat(aligned_word_parts[1]) //keep updating the end time, so the last aligned word's end time will be used
					ignore = false
					aligned_word_count++
				}
			})

			//keep track of the song's start and end times...
			if (song_start === null && start !== null) song_start = start
			if (end !== null) song_end = end

			compiled_line.push({
				word: word,
				processed_words: processed_words.trim(),
				start: start,
				end: end,
				ignore: ignore
			})
		})

		results.push(compiled_line)
	})

	//go back and fill in missing times. start by making sure we have valid start/end song times...
	if (song_start === null) song_start = 0
	if (song_end === null) song_end = song_start

	//fill in missing starts by going from start to finish...
	let prev_end = song_start
	for(let line_x = 0; line_x < results.length; line_x++)
	{
		for(let word_x = 0; word_x < results[line_x].length; word_x++)
		{
			if (results[line_x][word_x].start === null) results[line_x][word_x].start = prev_end
			if (results[line_x][word_x].end !== null) prev_end = results[line_x][word_x].end
		}
	}

	//fill in missing ends by going from finish to start...
	let prev_start = song_end
	for (let line_x = results.length - 1; line_x >= 0; line_x--)
	{
		for (let word_x = results[line_x].length - 1; word_x >= 0; word_x--)
		{
			if (results[line_x][word_x].end === null) results[line_x][word_x].end = prev_start
			if (results[line_x][word_x].start !== null) prev_start = results[line_x][word_x].start
		}
	}


	if (aligned_word_count != aligned_text_array.length)
	{
		throw new Error('Could not compile results. The aligned word count (' + aligned_word_count + ') does not match the raw word count (' + aligned_text_array.length + ')')
	}

	return results
}

function compile_ass(lyrics) {
	lyrics = lyrics.filter(line => line != '')
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
		const startOfVerse = line[0].start
		const endOfVerse = line[line.length - 1].end
		const offset = startOfVerse > 1 ? 100 : startOfVerse * 100
		const start = dayjs('1900-01-01').add(startOfVerse - (offset / 100), 'second').format('H:mm:ss.SSS').slice(0, -1)
		const end = dayjs('1900-01-01').add(endOfVerse, 'second').format('H:mm:ss.SSS').slice(0, -1)
		let verse = `Dialogue: 0,${start},${end},Default,,0000,0000,0000,,{\\K${offset}}`
		
		if (index < lyrics.length - 5) {
			const startOfNextVerse = arr[index + 1][0].start
			const gap = startOfNextVerse - endOfVerse
			if (gap >= 4) {
				const gapStart = dayjs('1900-01-01').add(startOfNextVerse - 5, 'second').format('H:mm:ss.SSS').slice(0, -1)
				const gapEnd = dayjs('1900-01-01').add(startOfNextVerse, 'second').format('H:mm:ss.SSS').slice(0, -1)
				lines.push(`Dialogue: 0,${gapStart},${gapEnd},Default,,0000,0000,0000,,{\\K500}🎵🎵🎵🎵🎵`)
			}
		}

		line.forEach(word => {
			const duration = Math.round(word.end * 100) - Math.round(word.start * 100)
			if (duration) {
				verse += `{\\K${duration}}${word.word}{\\K0} `
			} else {
				verse += `${word.word} `
			}
		})
		lines.push(verse)
	})
	lines = lines.join('\r\n')
	return lines
}

module.exports.index = index
