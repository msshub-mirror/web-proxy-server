const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// HTML or バイナリプロキシ中継（GET）
app.get('/proxy', async (req, res) => {
  await handleProxy(req, res, 'GET');
});

// HTML or バイナリプロキシ中継（POST）
app.post('/proxy', async (req, res) => {
  await handleProxy(req, res, 'POST');
});

async function handleProxy(req, res, method) {
  const targetUrl = req.query.url;
  const cors = req.query.cors === 'true';

  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const headers = {
      ...req.headers,
      host: new URL(targetUrl).host,
      cookie: req.headers.cookie || ''
    };

    const options = {
      method,
      headers,
      body: method === 'POST' ? new URLSearchParams(req.body) : undefined,
      redirect: 'manual'
    };

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || '';

    // Cookieの転送
    const setCookie = response.headers.raw()['set-cookie'];
    if (setCookie) {
      res.setHeader('set-cookie', setCookie);
    }

    if (cors) res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const baseUrl = new URL(targetUrl);
      const $ = cheerio.load(html);
      const proxyBase = req.protocol + '://' + req.get('host') + '/proxy?cors=' + cors + '&url=';

      // src/href 変換
      $('*[src], *[href]').each((_, el) => {
        const attr = el.attribs.src ? 'src' : 'href';
        const orig = el.attribs[attr];
        if (!orig || orig.startsWith('data:') || orig.startsWith('javascript:')) return;
        const abs = new URL(orig, baseUrl).href;
        el.attribs[attr] = proxyBase + encodeURIComponent(abs);
      });

      // form action 変換（method対応）
      $('form').each((_, el) => {
        const orig = el.attribs['action'] || baseUrl.href;
        const abs = new URL(orig, baseUrl).href;
        el.attribs['action'] = proxyBase + encodeURIComponent(abs);
        el.attribs['method'] = 'post';
      });

      // script内URL簡易変換
      $('script').each((_, el) => {
        if (el.children?.[0]?.data) {
          el.children[0].data = el.children[0].data.replace(/https?:\/\/[^'" ]+/g, (match) => {
            return proxyBase + encodeURIComponent(match);
          });
        }
      });

      res.setHeader('Content-Type', 'text/html');
      return res.send($.html());
    } else {
      // バイナリ中継（画像など）
      res.setHeader('Content-Type', contentType);
      response.body.pipe(res);
    }
  } catch (err) {
    res.status(500).send('Proxy error: ' + err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
