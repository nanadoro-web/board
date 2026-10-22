// 서령고 칠판 대시보드 v1.7 — 오프라인 열기용 서비스 워커
// - index.html 과 같은 폴더(깃허브 저장소 맨 위)에 올립니다.
// - 인터넷이 되면 항상 깃허브의 최신 대시보드를 받고, 그 사본을 칠판에 저장합니다.
// - 부팅 직후처럼 인터넷이 아직 안 되면(또는 4초 안에 응답이 없으면) 저장해 둔 사본을 띄웁니다.
// - 급식·동기화·호출(구글 Apps Script, Firebase) 요청은 건드리지 않습니다.

var CACHE = 'board-page-v1';
var PAGE = './';
var WAIT_MS = 4000;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.add(PAGE); })
      .then(function () { return self.skipWaiting(); }, function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache() {
  return caches.open(CACHE).then(function (c) { return c.match(PAGE); });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;   // 페이지 열기만 다룸
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function finish(res) { if (!done && res) { done = true; resolve(res); } }

    // 4초 안에 깃허브 응답이 없으면 저장본으로
    var timer = setTimeout(function () { fromCache().then(finish); }, WAIT_MS);

    fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(PAGE, copy); });
        clearTimeout(timer);
        finish(res);
      } else {
        fromCache().then(function (r) { clearTimeout(timer); finish(r || res); });
      }
    }, function () {
      fromCache().then(function (r) {
        clearTimeout(timer);
        if (r) finish(r);
        else finish(new Response('<meta charset="utf-8"><body style="background:#0D2350;color:#fff;font:40px sans-serif;text-align:center;padding-top:20vh">인터넷 연결을 기다리는 중이에요…<script>setTimeout(function(){location.reload()},5000)</script></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      });
    });
  }));
});
