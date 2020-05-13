# cwik
Cwik is an editable web site (wiki) that stores pages in git, outputs pages as markdown and uses bitcoin cash signatures for authentication and edit dispute resolution.


## Installation

### Prerequisites

#### Node JS

Install nodejs version 10.16.3.  Note that some dependencies do not compile in some later versions of node, so do not be surprised if you get a problem in the "npm install" step with other nodejs versions!

```
export NODEJS_VER=v10.16.3
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

Make a separate user:
```
adduser wiki
```

Make a documentation repository in github and ensure that your "wiki" user has commit access via ssh.

Copy/clone the cwik repo into your desired directory:
```
cd /opt
sudo git clone https://github.com/gandrewstone/cwik.git cwik
```

Clone your doc repository into the cwik/repo/mirror directory:
```
cd /opt/cwik
mkdir repo
cd repo
git clone https://github.com/MY_USER/MY_DOC_REPO.git mirror
```

"Install" npm:
```
cd /opt/cwik
npm install
```

The site is started like any nodejs project.  A simple way to start on port 8000 is to do:
```
export PORT=8000
npm start
```
