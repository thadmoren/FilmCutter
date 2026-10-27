#!/bin/zsh
# Double-click to serve Film Cutter on port 5004 (phone: Tailscale URL + :5004)
cd "$(dirname "$0")"
echo "Film Cutter → http://localhost:5004  (Ctrl-C to stop)"
python3 -m http.server 5004
