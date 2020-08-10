FROM node:14.4.0-alpine

RUN npm install -g npm@latest
RUN apk add \
    gcc \
    make \
    git \
    libc-dev \
    libcap-dev

WORKDIR /petrol
RUN git clone https://github.com/ioi/isolate.git
WORKDIR /petrol/isolate
RUN make isolate
RUN make install

WORKDIR /petrol/petrol
COPY package.json package-lock.json ./
RUN npm install
COPY ./ .
RUN npm run build

CMD npm run start
