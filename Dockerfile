FROM node:14.4.0-alpine

RUN npm install -g npm@latest

RUN apk add vim

WORKDIR /petrol
COPY package.json package-lock.json ./
RUN npm install
COPY ./ .
RUN npm run build

CMD npm run start
