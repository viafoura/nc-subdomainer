                           .        .                                    
                           |        |                    o               
    .--. .-. ____ .--..  . |.-.  .-.| .-. .--.--. .-.    .  .--. .-. .--.
    |  |(         `--.|  | |   )(   |(   )|  |  |(   )   |  |  |(.-' |   
    '  `-`-'      `--'`--`-'`-'  `-'`-`-' '  '  `-`-'`--' `-'  `-`--''   

Namecheap subdomain record manager.

### What?
This is a Node.js app for managing subdomain records for a given set of domains registered on Namecheap. Authentication through Github and is restricted to a given organization.

### Why?
Maybe you've got a dev team and a project that requires everyone to have unique domains.

### How?
You need Node.js and a redis server

## Dev Config
This project relies on environment variables and a single configuration file.

Environment variables this app expects:

    NODE_ENV                - "live" or "dev"

The rest of the settings can be set inside of "settings.js" which you'll have to copy and set

    cp settings.default.js settings.js

## Live Deploy

    npm install
    sudo cp nc-subdomainer.upstart /etc/init/nc-subdomainer.conf
    # Change values here to match your setup
    sudo vim /etc/init/nc-subdomainer.conf
    # Start it!
    sudo service nc-subdomainer start
    # Make sure all is well:
    cat /var/log/nc-subdomainer.log