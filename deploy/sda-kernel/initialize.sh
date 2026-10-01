#!/bin/sh
set -eu
# App Service mounts /home after image creation. Establish the runtime user's
# directory on that persistent mount, then drop privileges for every service.
mkdir -p /home/sjones
chown node:node /home/sjones
chmod 700 /home/sjones
exec runuser -u node -- env HOME=/home/sjones XDG_DATA_HOME=/home/sjones/.local/share node /opt/sfx/host/gateway.mjs
