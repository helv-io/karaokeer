FROM helvio/kaldi:latest
WORKDIR /usr/src/app
COPY ["align.js", "GeniusHandler.ts", "index.html", "index.ts", "Job.ts", "package.json", "string.extensions.ts", "tsconfig.json", "YouTubeHandler.ts", "/usr/src/app/"]
RUN npm install
RUN npx tsc
EXPOSE 3000
ENTRYPOINT ["node","index.js"]
