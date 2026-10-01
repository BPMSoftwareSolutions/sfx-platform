ARG WEBSITE_IMAGE
FROM ${WEBSITE_IMAGE}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends dbus gnome-keyring libsecret-tools ca-certificates libicu72 libssl3 util-linux && rm -rf /var/lib/apt/lists/*
COPY runtime/ /opt/sfx/
RUN tar -xzf /opt/sfx/kernel.tar.gz -C /opt/sfx/kernel && rm /opt/sfx/kernel.tar.gz && chown -R node:node /opt/sfx
ENV HOME=/home/sjones XDG_DATA_HOME=/home/sjones/.local/share PORT=3000
WORKDIR /opt/sfx
CMD ["sh", "/opt/sfx/host/initialize.sh"]
