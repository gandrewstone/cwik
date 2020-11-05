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
v12.18.0
```

#### Git

sudo apt-get install git


### Installation Procedure

These packages are required so that the server can simulate a client to render markdown.  If you have installed a web browser, your linux installation may already have these dependencies, but if you are running a console only 
```
sudo apt-get install libx11-xcb-dev libxcomposite1 libxcb-dri3-0 libnss3 libxss-dev libgbm-dev gconf-service libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxss1 libxtst6 libappindicator1 libnss3 libasound2 libatk1.0-0 libc6 ca-certificates fonts-liberation lsb-release xdg-utils
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
(cd /opt/stackedit; pm2 start index.js --name "stackedit")
(cd /opt/cwik; pm2 start start.sh --interpreter bash --name "cwik")
```

### JS file format

```
js-beautify -w 260
```

## Execution

### Development and Debug
The site is started like any nodejs project, except you need to run both stackedit and cwik.  For stackedit:

```
cd stackedit
node index.js
```
It will listen on port 8002.  If you change the listen port, you must change the cwik config.js file.  Note that if you have troubles with stackedit, you can point cwik to stackedit.io rather than running your own copy, by editing config.js.

Test stackedit by navigating to localhost:8002/app.  The stackedit editor should come up.  If it doesn't, you have a stackedit build or installation problem.  **MAKE SURE YOU CHECKED OUT THE "CWIK" BRANCH**

Starting CWIK (on port 8000) under npm is a nice way to develop, since it auto-restarts if javascript files are changed:
```
cd cwik
npm start
```

### Production

A production environment should run a web front end so that both cwik and stackedit can be served from port 80 while still running as the wiki user and in two separate processes.  Configure your DNS settings to point both your "main" site name and "stackedit.yourdomain.yourtld" to this machine.  Next, Nginx or Apache can be used to proxy requests to either cwik or stackedit.

#### Example Nginx configuration

```
server {
    listen 80;
    server_name stackedit.yourdomain.yourtld;
    location / {
        proxy_pass http://127.0.0.1:8002;
    }
}

server {
	listen 80 default_server;
	listen [::]:80 default_server;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;

	server_name _;

    # Unnecessary for now
    # location /_stackedit_ {
    # 	        rewrite ^/_stackedit_(.*) /$1 break;
	#        proxy_pass http://127.0.0.1:8002;
	# }

    location / {
		proxy_pass http://127.0.0.1:8000;
	}
}

```

#### Example Apache2 configuration

##### Install Required Modules

sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_balancer
sudo a2enmod lbmethod_byrequests

##### Apache2 configuration

```
<VirtualHost *:80>
	ServerName www.yourdomain.yourtld
	ServerAdmin webmaster@localhost

        ProxyPreserveHost On
        ProxyPass / http://127.0.0.1:8000/
        ProxyPassReverse / http://127.0.0.1:8000/

	ErrorLog ${APACHE_LOG_DIR}/error.log
	CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>

<VirtualHost *:80>
	ServerName explorer.yourdomain.yourtld
	ServerAdmin webmaster@localhost
        
        ProxyPreserveHost On
        ProxyPass / http://127.0.0.1:8001/
        ProxyPassReverse / http://127.0.0.1:8001/

	ErrorLog ${APACHE_LOG_DIR}/error.log
	CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>

<VirtualHost *:80>
	ServerName stackedit.yourdomain.yourtld
	ServerAdmin webmaster@localhost

        ProxyPreserveHost On
        ProxyPass / http://127.0.0.1:8002/
        ProxyPassReverse / http://127.0.0.1:8002/

	ErrorLog ${APACHE_LOG_DIR}/error.log
	CustomLog ${APACHE_LOG_DIR}/access.log combined

</VirtualHost>
```

#### Starting the servers

In release mode, a process manager is good practice.  I use pm2:

```
pm2 start index.js --name "stackedit"
pm2 start start.sh --interpreter bash --name "cwik"
```


### Troubleshooting

If you don't get the stackedit editor when you navigate to localhost:8002/app, cwik will hang on startup as it uses stackedit to translate your .md files into html.

If you cannot checkout, commit, etc your doc repo under the "wiki" user, cwik won't be able to do so either!

Even if you can checkout on the command line, cwik might have issues, especially if you are using multiple ssh keys.  Make sure the correct ssh key is loaded into the ssh agent (look at start.sh for my attempt to ensure this, and modify it as needed).

