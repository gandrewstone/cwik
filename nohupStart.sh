#!/bin/bash
setsid nohup ./start.sh < /dev/null &
sleep 1
tail -f nohup.out
