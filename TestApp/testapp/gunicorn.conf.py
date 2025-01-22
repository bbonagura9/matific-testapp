# Based on:
# https://github.com/benoitc/gunicorn/blob/master/examples/example_config.py

import multiprocessing
import os

if os.environ.get('DEBUG', False):
    reload = True

wsgi_app = "testapp.wsgi"
bind = ['0.0.0.0:8000']

# Source: https://docs.gunicorn.org/en/stable/design.html#how-many-workers
workers = int(os.environ.get('GUNICORN_WORKERS') or 2 * multiprocessing.cpu_count() + 1)
worker_class = os.getenv('GUNICORN_WORKER_CLASS', 'gthread')

# Set worker temp dir in a memory-only part of the filesystem so that workers
# are not frequently blocked
# See: https://docs.gunicorn.org/en/stable/faq.html#how-do-i-avoid-gunicorn-excessively-blocking-in-os-fchmod
# Also: https://pythonspeed.com/articles/gunicorn-in-docker/
worker_tmp_dir = '/dev/shm'

threads = int(os.getenv('GUNICORN_THREADS', '4'))
keepalive = int(os.getenv('GUNICORN_KEEP_ALIVE', '90'))

errorlog = '-'
loglevel = os.getenv('GUNICORN_LOG_LEVEL', 'debug')
accesslog = '-'

access_log_format = os.getenv("GUNICORN_ACCESS_LOG_FORMAT", '%(h)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"')

statsd_host = os.getenv("GUNICORN_STATSD_HOST")
statsd_prefix = os.getenv("GUNICORN_STATSD_PREFIX")


def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def pre_exec(server):
    server.log.info("Forked child, re-executing.")


def when_ready(server):
    server.log.info("Server is ready. Spawning workers")


def worker_int(worker):
    worker.log.info("worker received INT or QUIT signal")


def worker_abort(worker):
    worker.log.info("worker received SIGABRT signal")
