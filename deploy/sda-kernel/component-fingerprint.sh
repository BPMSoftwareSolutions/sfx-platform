#!/bin/sh
# Fingerprint the admitted components under /opt/sfx into <out-dir>, one file per
# component. Both stages of Dockerfile.composite run this same script; the runtime
# stage refuses the image unless every fingerprint equals the component stage's.
# A tree fingerprint covers file paths, contents and modes, and symlink targets.
set -eu
out="$1"
mkdir -p "$out"
cd /opt/sfx
for component in kernel api procedure-extract identity; do
  (cd "$component" && {
    find . -type f -print0 | sort -z | xargs -0 sha256sum
    find . -type f -printf '%p %m\n' | sort
    find . -type l -printf '%p -> %l\n' | sort
  }) | sha256sum | cut -d' ' -f1 > "$out/$component"
done
sha256sum vault-bootstrap.tar.gz | cut -d' ' -f1 > "$out/vault-bootstrap.tar.gz"
sha256sum estate/sfx.config.json | cut -d' ' -f1 > "$out/sfx.config.json"
