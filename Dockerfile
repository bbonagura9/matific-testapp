FROM python:3.9-slim

COPY ./TestApp /TestApp

RUN pip install -r /TestApp/requirements.txt

WORKDIR /TestApp/testapp
EXPOSE 8000

CMD ["gunicorn"]
