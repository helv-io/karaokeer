import yargs from 'yargs'
import express from 'express'
import FileUpload from 'express-fileupload'
import Colors from 'colors/safe'
import { Queue } from 'queue-system'
import path from 'path'
const align = require('./align')

const app = express()
const queue = new Queue()

app.use(FileUpload({
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

const main = async () => {
    const args = await argv
    console.log(`
==================
= AutoLyrixAlign =
==================

Starting service...`)
    
    queue.setConcurrency(args.concurrency)
    
    //setup routes...
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/index.html')))
    app.get('/version', (req, res) => res.status(200).send(`${process.env.npm_package_name} ${process.env.npm_package_version}`));
    app.post('/align', align.index);
    
    app.listen(args.port, async () => {
        console.log(Colors.green('✔') + ` Listening on port ${args.port}!`);
    });
}

main()