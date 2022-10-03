import express from 'express'
import FileUpload from 'express-fileupload'
import path from 'path'
import { getGeniusSong } from './GeniusHandler'
import { YTDownload, YTSearch } from './YouTubeHandler'
const align = require('./align')

const app = express()

app.use(FileUpload({
	createParentPath: true,
	safeFileNames: true
}));

(async () => {
    console.log(`
==================
= AutoLyrixAlign =
==================

Starting service...`)
    
    // Routes
    app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '/index.html')))
    app.get('/version', (_req, res) => res.status(200).send(`${process.env.npm_package_name} ${process.env.npm_package_version}`))
    app.post('/align', align.index)
	app.get('/genius/:id', (req, res) => { getGeniusSong(req.params.id, res) })
    app.get('/youtube/search/:query', (req, res) => { YTSearch(req.params.query, res) })
    app.get('/youtube/download/:id', (req, res) => { YTDownload(req.params.id, res) })
    
    app.listen(3000, async () => {
        console.log('✔ Listening on port 3000!')
    });
})()