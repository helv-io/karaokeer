# AutoLyrixAlign Service
### Accurate word-level alignment of lyrics to polyphonic audio

This is a Docker wrapper around [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign) and [gazugafan/AutoLyrixAlignService](https://github.com/gazugafan/AutoLyrixAlignService)

All the real work is done by the system developed at [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign), though. Amazing work going on over there that's honestly over my head. I just wanted to use it as a foolproof API service.

## Requirements
* **Docker** [Official Installation Docs](https://docs.docker.com/engine/install/)
* **RAM**. [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign) recommends having 20GB of RAM. I've found that it uses closer to 13GB. Your mileage may vary!
* **Disk Space**. You'll need about 16GB free to automatically download and extract the necessary data files. After the initial setup, about a 13GB footprint will remain used.

## Installation
* `docker run --name lyrix -p 3000:3000 helvio/lyrix`

## Usage
With the server running, you should be able to open `localhost:3000` in your browser (adjust the port and domain for however you set things up). This will bring you to a simple page where you can test out the API. Select a file, enter lyrics, and submit the form. You should see some simple logs output in the server console, and after a few minutes you should get the results back in the browser!

To use the service programatically, just send a POST request to `/align` the same way the form does. Be sure to set the `Content-Type` header to `multipart/form-data`. The POST parameters are...
* `audio_file` The polyphonic audio file to align with. Can be MP3, WAV, etc.
* `lyrics` The lyrics to align. Can include any sort of newline characters you like, special characters, song part identification lines (like [Chorus]), backup lines (like (woo) or \*breathes\*), etc. Anything you throw at it should work.
* `format` What format you'd like the results returned in. Can be set to `raw` or `json` (defaults to `json`). `raw` gives you the results directly from the alignment process. `json` massages those results into an array of lines and words that should match back up to the original lyrics supplied.

You can also get the current version with a GET request to `/version`.