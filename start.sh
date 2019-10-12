#!/bin/bash
# Do this to post the side on port 80: sudo iptables -A PREROUTING -t nat -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 8000
export PORT=8000
eval $(ssh-agent -s)
ssh-add
npm start
