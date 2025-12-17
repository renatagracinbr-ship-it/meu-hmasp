#!/bin/bash
cd /opt/hmasp/hmasp-chat-v2
git pull origin main
npm install
npm run build
sudo systemctl restart hmasp-chat
