FROM helvio/kaldi:latest
WORKDIR /usr/src/app
COPY ["align.js", "index.ts", "GeniusHandler.ts", "YouTubeHandler.ts", "index.html", "tsconfig.json", "package.json", "/usr/src/app/"]
RUN npm install
RUN npx tsc
EXPOSE 3000
ENTRYPOINT ["node","index.js"]
