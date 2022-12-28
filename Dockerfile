FROM helvio/kaldi:latest
WORKDIR /usr/src/app
ADD src package*.json /usr/src/app/
RUN npm i --omit=dev
EXPOSE 3000
ENTRYPOINT ["npx","tsx","index.ts"]
