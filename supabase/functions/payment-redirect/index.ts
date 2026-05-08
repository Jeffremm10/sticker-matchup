// Stripe success URL for native Android payments.
// Chrome Custom Tab follows HTTP 302 redirects to intent URIs natively,
// which closes the tab and opens the app — no JS execution needed.
Deno.serve((req) => {
  const url = new URL(req.url);
  const search = url.searchParams.toString();
  const intentUrl = `intent://payment-return?${search}#Intent;scheme=io.swapstrat.app;package=io.swapstrat.app;end`;

  return new Response(null, {
    status: 302,
    headers: { "Location": intentUrl },
  });
});
