                           .        .                                    
                           |        |                    o               
    .--. .-. ____ .--..  . |.-.  .-.| .-. .--.--. .-.    .  .--. .-. .--.
    |  |(         `--.|  | |   )(   |(   )|  |  |(   )   |  |  |(.-' |   
    '  `-`-'      `--'`--`-'`-'  `-'`-`-' '  '  `-`-'`--' `-'  `-`--''   

Namecheap subdomain record manager.

### What?
This is a Node.js app for managing subdomain records for a given set of domains registered on Namecheap. Authentication through Github.

### Why?
Maybe you've got a dev team and a project that requires everyone to have unique domains.

### How?
Designed to be launched into the Heroku free teir.

## Dev Config
This project relies on environment variables and a single configuration file.

Environment variables this app expects:

    NODE_ENV                - "live" or "dev"

The rest of the settings can be set inside of "settings.js" which you'll have to copy and set

    cp settings.default.js settings.js

## Live Deploy