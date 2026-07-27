const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = false;
const isUnixSocket = process.env.PORT && isNaN(process.env.PORT);
const port = isUnixSocket ? process.env.PORT : (parseInt(process.env.PORT, 10) || 3000);

const app = next({ 
  dev,
  ...(isUnixSocket ? {} : { hostname: "localhost", port }) 
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> Ready on ${isUnixSocket ? "Unix socket " : "http://localhost:"}${port}`);
  });
});
