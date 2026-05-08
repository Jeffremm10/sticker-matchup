// Stripe success URL target for native Android payments.
// Stripe redirects the Chrome Custom Tab here after payment. We immediately
// redirect to the Android intent URI — Chrome follows HTTP-level intent redirects
// without needing a user gesture, which closes the tab and opens the native app.
Deno.serve((req) => {
  const url = new URL(req.url);
  const search = url.searchParams.toString();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Returning to SwapStrat…</title>
  <script>
    var s = ${JSON.stringify(search)};
    var ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.location.href = 'intent://payment-return?' + s + '#Intent;scheme=io.swapstrat.app;package=io.swapstrat.app;end';
    } else {
      window.location.href = 'io.swapstrat.app://payment-return?' + s;
    }
  </script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:64px 32px;background:#000;color:#fff;">
  <p style="font-size:20px;font-weight:800;">Payment complete!</p>
  <p style="color:#aaa;margin-bottom:32px;">Returning to SwapStrat…</p>
  <a id="btn" style="display:inline-block;padding:14px 32px;background:#adff2f;color:#000;border-radius:12px;font-weight:800;font-size:16px;text-decoration:none;">
    Open SwapStrat
  </a>
  <script>
    document.getElementById('btn').addEventListener('click', function() {
      var s = ${JSON.stringify(search)};
      var ua = navigator.userAgent;
      if (/android/i.test(ua)) {
        window.location.href = 'intent://payment-return?' + s + '#Intent;scheme=io.swapstrat.app;package=io.swapstrat.app;end';
      } else {
        window.location.href = 'io.swapstrat.app://payment-return?' + s;
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
