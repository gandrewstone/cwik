#!/bin/bash
setsid nohup ./start.sh < /dev/null &
tail -f nohup.out
