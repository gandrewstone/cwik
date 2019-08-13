!#/bin/bash
export PORT=80
eval $(ssh-agent -s)
ssh-add
npm start
