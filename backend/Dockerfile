FROM alpine:3.7

RUN apk add --no-cache build-base python3 python3-dev libffi-dev libressl-dev postgresql-dev linux-headers

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

ADD ./ /backend
WORKDIR /backend

EXPOSE 8000
