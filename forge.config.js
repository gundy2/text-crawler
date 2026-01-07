module.exports = {
  packagerConfig: {
    asar: true,
    icon: './icon', // Ensure there is a comma here
    ignore: [
      /^\/src/,
      /^\/helpers/,
      /^\/\.git/,
      /^\/out/
    ]
  }, // This closing brace should lead into rebuildConfig
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-wix',
      config: {
        name: "Star Wars Crawl Studio",
        manufacturer: "CrawlStudio",
        description: "A Star Wars style opening crawl generator.",
        icon: './icon.ico',
        arch: "x64" 
      }
    }
  ],
};
