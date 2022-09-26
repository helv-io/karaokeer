const pjson = require('./package.json')
const yargs = require('yargs')
const colors = require('colors/safe')
const express = require('express')
const fileUpload = require('express-fileupload')
const { queue } = require('./queue')
const root = require('./root')
const align = require('./align')

const app = express()

app.use(fileUpload({
	createParentPath: true,
	safeFileNames: true
}))

const argv = yargs
	.option('port', {
		alias: 'p',
		description: 'The port to listen on',
		default: 3000
	})
	.option('concurrency', {
		alias: 'c',
		description: 'The max number of alignment processes to run at the same time',
		default: 1
	})
	.option('debug', {
		description: 'Outputs more info, including the alignment command output',
		type: 'boolean',
		default: true
	})
	.help().alias('help', 'h')
	.argv

console.log('==================')
console.log('= AutoLyrixAlign =')
console.log('==================')
console.log('')
console.log('Starting service...')

queue.setConcurrency(argv.concurrency)

//setup routes...
app.get('/', root.index)
app.get('/version', (req, res) => res.status(200).send(`${pjson.name} ${pjson.version}`))
app.post('/align', align.index)

app.listen(argv.port, () => { `Listening on port ${argv.port}!` })