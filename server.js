const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Parse URL
  let urlPath = req.url;
  
  // Remove query string
  const queryIndex = urlPath.indexOf('?');
  if (queryIndex !== -1) {
    urlPath = urlPath.substring(0, queryIndex);
  }
  
  // Map URLs to file paths
  let filePath;
  
  if (urlPath === '/' || urlPath === '') {
    // Default to lobby
    filePath = './index.html';
  } else if (urlPath === '/theluxe' || urlPath === '/theluxe/') {
    filePath = './theluxe/index.html';
  } else if (urlPath === '/lebandit' || urlPath === '/lebandit/') {
    filePath = './lebandit/index.html';
  } else if (urlPath === '/lobby' || urlPath === '/lobby/') {
    filePath = './index.html';
  } else if (urlPath === '/casishenwin' || urlPath === '/casishenwin/') {
    filePath = './casishenwin/index.html';
  } else if (urlPath.startsWith('/theluxe/')) {
    filePath = '.' + urlPath;
  } else if (urlPath.startsWith('/lebandit/')) {
    filePath = '.' + urlPath;
  } else if (urlPath.startsWith('/casishenwin/')) {
    filePath = '.' + urlPath;
  } else if (urlPath.startsWith('/lobby/')) {
    filePath = '.' + urlPath;
  } else if (urlPath.startsWith('/shared/')) {
    filePath = '.' + urlPath;
  } else {
    // Static files in game folders
    filePath = '.' + urlPath;
  }
  
  // Security: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const currentDir = path.resolve('.');
  
  if (!resolvedPath.startsWith(currentDir)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>', 'utf-8');
    return;
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>404 Not Found</h1><p>${req.url}</p>`, 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      // Add CORS headers for WebSocket connections
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Slot Game Server`);
  console.log(`=================================`);
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('Available games:');
  console.log(`  - Lobby:      http://localhost:${PORT}/lobby/`);
  console.log(`  - TheLuxe:    http://localhost:${PORT}/theluxe/`);
  console.log(`  - LeBandit:   http://localhost:${PORT}/lebandit/`);
  console.log(`  - Casishenwin: http://localhost:${PORT}/casishenwin/`);
  console.log(`=================================`);
});
