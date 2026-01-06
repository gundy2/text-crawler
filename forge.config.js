module.exports = {
  packagerConfig: {
    asar: true,
    icon: './icon'
  },
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
        description: "A Star Wars style opening crawl generator.", // Add this line
        icon: './icon.ico', // Icon for the Add/Remove Programs list
        // This ensures the installer works on 64-bit Windows
        arch: "x64" 
      }
    }
  ],
};