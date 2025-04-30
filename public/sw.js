self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 外部ドメインへのリクエストをプロキシ経由に変更
  const isExternal = /^https?:\/\//.test(url) && !url.includes(self.location.hostname);

  if (isExternal) {
    const proxyUrl = `/proxy?url=${encodeURIComponent(url)}&cors=true`;

    event.respondWith(
      fetch(proxyUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.body,
        mode: 'same-origin',
        credentials: 'include'
      })
    );
  }
});
