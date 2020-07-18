# cwik
Cwik is an editable web site (wiki) that stores pages in git, outputs pages as markdown and uses bitcoin cash signatures for authentication and edit dispute resolution.


## Installation

### Prerequisites

#### Node JS

Install nodejs version 12.18.0.  Note that some dependencies do not compile in some later versions of node, so do not be surprised if you get a problem in the "npm install" step with other nodejs versions!

```
export NODEJS_VER=v12.18.0
wget https://nodejs.org/dist/${NODEJS_VER}/node-${NODEJS_VER}-linux-x64.tar.xz /tmp
cd /opt
sudo tar xvf /tmp/node-${NODEJS_VER}-linux-x64.tar.xz
sudo ln -s node-${NODEJS_VER}-linux-x64 nodejs
export PATH=/opt/nodejs/bin:$PATH
```

Also add that path export to your startup.
Node is properly installed if:
```
wiki@reference:/opt$ node --version
v10.16.3
```

#### Git

sudo apt-get install git


### Installation Procedure

These packages are required so that the server can simulate a client to render markdown.  If you have installed a web browser, your linux installation may already have these dependencies.
```
sudo apt-get install libxcb-dri3-0 libnss3 libxss-dev libgbm-dev
```

Make a separate user:
```
adduser wiki
```

Make a documentation repository in github and ensure that your "wiki" user has commit access via ssh.

Copy/clone the cwik repo into your desired directory:
```
cd /opt
sudo mkdir git
sudo chown username.username git
cd git
git clone https://github.com/gandrewstone/cwik.git cwik
```

Copy/clone the stackedit dependency into your desired directory, and check out the cwik branch.
```
git clone https://github.com/gandrewstone/stackedit.git
cd stackedit
git checkout cwik
```

Install stackedit
```
npm install
npm run build
```

Install cwik
```
cd ../cwik
npm install
```

Change cwik/config.js to your configuration
```
emacs config.js
```

Install cwik dependencies:
```
cd /opt/cwik
npm install
```

Install a process manager and start up the node processes
```
sudo npm install pm2 -g
pm2 start index.js --name "stackedit"
pm2 start start.sh --interpreter bash --name "cwik"
```

### JS file format

```
js-beautify -w 260
```

## Execution

### Debug
The site is started like any nodejs project.  A simple way to start on port 8000 is to do:
```
export PORT=8000
npm start
```

### Production

```
pm2 start start.sh --interpreter bash --name "cwik"
```
