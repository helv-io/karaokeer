# Karaokeer Service

### Accurate word-level alignment of lyrics to polyphonic audio

[![Build Status](https://jenkins.helv.io/buildStatus/icon?job=helvio%2Fkaraokeer)](https://jenkins.helv.io/job/helvio/job/karaokeer/)

This is a Docker wrapper around [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign) and [gazugafan/AutoLyrixAlignService](https://github.com/gazugafan/AutoLyrixAlignService)

All the real work is done by the system developed at [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign), though. Amazing work going on over there that's honestly over my head. I just wanted to use it as a foolproof API service.

## Requirements

- **Docker** [Official Installation Docs](https://docs.docker.com/engine/install/)
- **RAM**. [chitralekha18/AutoLyrixAlign](https://github.com/chitralekha18/AutoLyrixAlign) recommends having 20GB of RAM. I've found that it uses closer to 13GB. Your mileage may vary!
- **Disk Space**. You'll need about 16GB free to automatically download and extract the necessary data files. After the initial setup, about a 13GB footprint will remain used.

## Installation

- `docker run -d --name karaokeer -v /home/user/karaoke:/media/karaoke -p 3000:3000 helvio/karaokeer`

## Environment Variables

| Variable                   | Description                           | Default        |
| -------------------------- | ------------------------------------- | -------------- |
| KARAOKE_OUTPUT             | Folder to save Karaoke files          | /media/karaoke |
| GENIUS_API                 | Genius API Key                        | (blank)        |