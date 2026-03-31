function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendPurchaseReceiptEmail(args: {
  to: string
  downloadUrlPdf: string
  downloadUrlStl: string
  productName: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? 'Parasys <onboarding@resend.dev>'
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not set' }
  }

  const subject = 'Your design package is ready'
  const safeName = escapeHtml(args.productName)
  const safePdf = escapeHtml(args.downloadUrlPdf)
  const safeStl = escapeHtml(args.downloadUrlStl)
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
<p>Thanks for your purchase.</p>
<p><strong>${safeName}</strong></p>
<p><a href="${safePdf}">Download PDF</a> (drawings &amp; parts sheet)</p>
<p><a href="${safeStl}">Download STL</a> (3D solid)</p>
<p style="font-size:0.9em;color:#555">PDF link:</p>
<p style="font-size:0.85em;word-break:break-all;color:#333">${safePdf}</p>
<p style="font-size:0.9em;color:#555">STL link:</p>
<p style="font-size:0.85em;word-break:break-all;color:#333">${safeStl}</p>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    return { ok: false, error: msg || `Resend HTTP ${res.status}` }
  }
  return { ok: true }
}
