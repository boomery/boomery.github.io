(function () {
  var text = '2026-09-23 21:40';
  if (document.getElementById('siteUpdated')) return;
  var style = document.createElement('style');
  style.textContent = '#siteUpdated{position:fixed;right:14px;bottom:12px;z-index:40;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.9);border:1px solid rgba(74,95,212,.16);color:#6b7280;font:12px/1.4 Inter,"PingFang SC",system-ui,sans-serif;pointer-events:none;box-shadow:0 6px 18px rgba(80,100,160,.12)}';
  document.head.appendChild(style);
  var el = document.createElement('time');
  el.id = 'siteUpdated';
  el.dateTime = text.replace(' ', 'T') + '+08:00';
  el.textContent = '更新于 ' + text;
  if (document.querySelector('.upload-fab')) el.style.right = '92px';
  document.body.appendChild(el);
})();
