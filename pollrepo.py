#!/usr/bin/python3
import requests
from datetime import datetime
import pdb
import os
import time

PollInterval = 60
LastUpdate = None

def main():
    global PollInterval, LastUpdate

    
    LastUpdate = datetime.now()
    print("Updating repo on startup")
    result = os.system("pwd; git pull")
    print(result)

    while 1:
        response = requests.get("https://api.github.com/repos/gandrewstone/cwik/events")
        if (response.status_code >= 200) and (response.status_code < 300):
            print ("request successful")
            data = response.json()
            PollInterval = int(response.headers.get("X-Poll-Interval", 60))+1
            print("new poll interval: %d" % PollInterval)
            etag = response.headers.get("ETag")
            if len(data)>0:
                print("nrecords: ", len(data))
                lastEvt = data[0]
                evtTime = lastEvt["created_at"]
                dt = datetime.strptime(evtTime, "%Y-%m-%dT%H:%M:%SZ")
                print("last update: " + str(dt))
                if dt > LastUpdate:
                    print("Updating repo to the change made on " + str(dt))
                    result = os.system("git pull")
                    print(result)
                    LastUpdate = dt
                else:
                    print(str(dt) + " is not sooner than " + str(LastUpdate))
        time.sleep(PollInterval)

if __name__== "__main__":
  main()

def Test():
    os.chdir("/fast/bitcoin/cwik")
    main()
