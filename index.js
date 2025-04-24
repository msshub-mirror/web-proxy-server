const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// プロキシ用のエンドポイント
app.use('/proxy', (req, res, next) => {
  const targetUrl = req.query.url;
  const cors = req.query.cors === 'true';

  if (!targetUrl) {
    return res.status(400).send('urlパラメータが必要です');
  }

  // CORSヘッダーを付加
  if (cors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: () => '/',
    logLevel: 'debug',
    selfHandleResponse: false,
  });

  return proxy(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
