FROM helvio/kaldi:latest
WORKDIR /usr/src/app
COPY ["align.js", "GeniusHandler.ts", "index.html", "index.ts", "Job.ts", "package.json", "string.extensions.ts", "tsconfig.json", "YouTubeHandler.ts", "/usr/src/app/"]
RUN npm install --omit=dev
EXPOSE 3000
ENTRYPOINT ["npx","tsx","index.ts"]
