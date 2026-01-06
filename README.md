# Star Wars Crawl Studio

A professional-grade Windows desktop application for generating and recording custom Star Wars-style opening crawls. Built with Electron, Three.js, and Opentype.js.

## Features
- **Dynamic Text Rendering**: High-fidelity typography using Opentype.js.
- **Auto-Sizing Canvas**: Automatically adjusts the crawl height to fit any story length.
- **Built-in Recording**: Capture your crawl as a high-quality .webm video (VP9) with synchronized audio.
- **Standalone Installer**: Includes a WiX-based MSI installer for Windows.

## Installation
1. Download the latest `.msi` from the releases folder.
2. Run the installer and follow the Windows prompts.

## Development & Building
If you want to modify the source code:

1. **Clone the repo:**
   ```bash
   git clone <your-repo-url>
Install dependencies:

Bash

npm install
Run in development mode:

Bash

npm start
Build the EXE and MSI:

Bash

npm run make
Requirements
Node.js: v18 or higher.

WiX Toolset v3: Required to generate the MSI installer.
