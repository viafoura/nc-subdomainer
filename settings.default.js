exports.settings = {
    // The "main" domain, the main app entry point
    NCSUBDOMAIN: "example.com", // "localhost" should be fine for dev
    NC_APIKEY: "", // Namecheap API key
    NC_USER: "", // Namecheap Username
    NC_ALLOWEDIP: "", // App's allowed IP address (must also be set in Namecheap control panel)

    // Setup your github creds here
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GITHUB_ORG: "",

    // What domains in the namecheap account do you want to use with subdomains?
    enabledDomains: ["viafoundry.com", "fiavoura.com", "viafourous.com"]
};