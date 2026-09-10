#!/bin/sh
set -eu
# /home is the existing App Service persistent volume. Drop privileges before
# starting either the server or its permission-restricted delivery processes.
mkdir -p /home/sidefx-runs
chown node:node /home/sidefx-runs
chmod 700 /home/sidefx-runs
exec su -s /bin/sh node -c 'exec node --import tsx scripts/start-remote-lab.mjs'
