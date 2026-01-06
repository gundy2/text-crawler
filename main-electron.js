const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'icon.ico'),
    fullscreenable: true, 
    backgroundColor: '#000000',
    webPreferences: {
      // Vital for loading your local font and texture files
      webSecurity: false 
    }
  });

  win.loadFile('index.html');
  
  // Optional: Remove the top menu bar (File, Edit, etc.)
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});