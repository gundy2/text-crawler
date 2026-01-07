const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;
let aboutWindow;

function createAboutWindow() {
  // Prevent multiple about windows from opening
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  aboutWindow = new BrowserWindow({
    width: 450,
    height: 350,
    title: "About Star Wars Crawl Studio",
    icon: path.join(__dirname, 'icon.ico'),
    resizable: false,
    minimizable: false,
    autoHideMenuBar: true, // Keep the about window clean
    webPreferences: {
      nodeIntegration: false
    }
  });

  aboutWindow.loadFile('about.html');

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'icon.ico'),
    fullscreenable: true,
    backgroundColor: '#000000',
    webPreferences: {
      webSecurity: false // Required for loading local font/audio files
    }
  });

  mainWindow.loadFile('index.html');

  // BUILD THE MENU
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Crawl Studio',
          click: () => createAboutWindow()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
