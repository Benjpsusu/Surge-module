// Surge http-response script: inject JS to copy magnet links instead of navigating.

function getHeader(headers, key) {
  if (!headers) return "";
  return headers[key] || headers[key.toLowerCase()] || "";
}

const headers = $response.headers || {};
const ct = getHeader(headers, "Content-Type");
let body = $response.body;

if (!body || !/text\/html/i.test(ct)) $done({});

const hasMagnet =
  body.includes('href="magnet:') ||
  body.includes("href='magnet:") ||
  body.includes("magnet:?xt=");

if (!hasMagnet) $done({});

const injected = `
<script>
(function () {
  function toast(msg) {
    try {
      var d = document.createElement('div');
      d.textContent = msg;
      d.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);padding:10px 14px;background:rgba(0,0,0,.75);color:#fff;border-radius:10px;z-index:2147483647;font-size:14px;max-width:80%;text-align:center;';
      document.documentElement.appendChild(d);
      setTimeout(function(){ d.remove(); }, 1200);
    } catch (e) {}
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject){
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        ok ? resolve() : reject(new Error('execCommand failed'));
      } catch (e) { reject(e); }
    });
  }

  function handleMagnet(url) {
    if (!url || url.indexOf('magnet:') !== 0) return false;
    copyText(url).then(function(){ toast('已复制磁力链接'); })
      .catch(function(){ window.prompt('复制失败，请手动复制：', url); });
    return true;
  }

  // 1) 拦截 <a href="magnet:...">
  document.addEventListener('click', function(e){
    var el = e.target;
    while (el && el !== document.documentElement) {
      if (el.tagName === 'A') break;
      el = el.parentElement;
    }
    if (!el || el.tagName !== 'A') return;
    var href = el.getAttribute('href') || '';
    if (href.indexOf('magnet:') !== 0) return;
    e.preventDefault(); e.stopPropagation();
    handleMagnet(href);
  }, true);

  // 2) 兼容站点用 JS 触发跳转（location.assign/replace/window.open）
  try {
    var _assign = window.location.assign.bind(window.location);
    window.location.assign = function(u){ if (handleMagnet(String(u))) return; return _assign(u); };

    var _replace = window.location.replace.bind(window.location);
    window.location.replace = function(u){ if (handleMagnet(String(u))) return; return _replace(u); };

    var _open = window.open;
    window.open = function(u){
      if (u && handleMagnet(String(u))) return null;
      return _open.apply(window, arguments);
    };
  } catch (e) {}
})();
</script>
`;

function injectIntoHtml(html) {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, injected + "</body>");
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, "</head>" + injected);
  return html + injected;
}

body = injectIntoHtml(body);

// 删除 CSP 以免阻止内联脚本；同时移除 Content-Length（Surge 不允许你“手动改”它）
const newHeaders = Object.assign({}, headers);
delete newHeaders["Content-Security-Policy"];
delete newHeaders["content-security-policy"];
delete newHeaders["Content-Security-Policy-Report-Only"];
delete newHeaders["content-security-policy-report-only"];
delete newHeaders["Content-Length"];
delete newHeaders["content-length"];

$done({ body, headers: newHeaders });
