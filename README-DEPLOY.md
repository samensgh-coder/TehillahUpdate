# Deploying tehillahdigital.co.uk to Azure

This site is plain HTML/CSS/JS with one small Azure Function (`/api/contact`)
for the contact form — there's no build step. The recommended host is
**Azure Static Web Apps**, which gives you free TLS, a global CDN, and the
serverless API in one resource.

---

## Option A — Azure Static Web Apps (recommended)

### 1. Push this folder to a GitHub repository
Azure Static Web Apps deploys from a GitHub (or Azure DevOps) repo via
GitHub Actions. Create a new repo (e.g. `tehillah-digital-site`) and push
everything in this folder to its `main` branch, including the `.github/`
folder — that workflow file is what triggers deployment.

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<your-username>/tehillah-digital-site.git
git push -u origin main
```

### 2. Create the Static Web App resource
In the [Azure Portal](https://portal.azure.com):
1. Search for **Static Web Apps** → **Create**.
2. Subscription/Resource group: choose or create one (e.g. `tehillah-digital-rg`).
3. Name: `tehillah-digital` (or similar).
4. Plan type: **Free** is enough to start; upgrade to **Standard** later if
   you need more bandwidth/custom auth.
5. Region: choose **UK South** for the Azure Functions region. Static Web
   Apps' global CDN serves the static pages worldwide regardless, but
   pinning the Functions region to UK South keeps the contact-form
   backend and any data it touches inside the UK, consistent with the
   "secure UK hosting" requirement in the brand brief.
6. Deployment source: **GitHub** → sign in and pick the repo and `main` branch.
7. Build details:
   - Build presets: **Custom**
   - App location: `/`
   - Api location: `api`
   - Output location: *(leave blank — there's no build step)*
8. Click **Review + create**, then **Create**.

Azure automatically commits a copy of the GitHub Actions workflow to your
repo and adds an `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. The workflow
file already included in `.github/workflows/azure-static-web-apps.yml`
matches this layout, so if Azure adds its own version, keep whichever one
has your correct app/api locations and delete the duplicate.

Within a few minutes, your site will be live at a default address like
`https://<random-name>.azurestaticapps.net`.

### 3. Point www.tehillahdigital.co.uk at it
In the Static Web App resource:
1. Go to **Custom domains** → **Add**.
2. Enter `www.tehillahdigital.co.uk` → choose **CNAME**.
3. Azure shows you the exact record to add.

In your domain's DNS (wherever tehillahdigital.co.uk is registered/managed):

| Type  | Name / Host | Value                                   |
|-------|-------------|------------------------------------------|
| CNAME | www         | `<your-app-name>.azurestaticapps.net`    |
| TXT   | `_dnsauth.www` (Azure will give the exact name) | validation token shown in the portal |

Wait for DNS to propagate (usually minutes, sometimes a few hours), then
click **Validate** in the portal. Azure issues a free TLS certificate
automatically once validated.

**Root domain (tehillahdigital.co.uk without www):** most UK registrars
don't allow a CNAME at the root. Either:
- Set up an **ALIAS/ANAME** record at the root pointing to the same
  `azurestaticapps.net` hostname (if your DNS provider supports it), or
- Simply redirect the root to `www` using your registrar's forwarding
  feature, and only add the root as a second custom domain in Azure once
  it resolves correctly.

### 4. Wire up the contact form email
The `/api/contact` function already validates submissions. To have it
actually send an email:
1. Create a free [SendGrid](https://sendgrid.com) account (or use any
   provider — Azure Communication Services email is another option) and
   verify a sender address.
2. In the Static Web App resource → **Configuration** → **Application
   settings**, add:
   - `SENDGRID_API_KEY`
   - `CONTACT_TO_EMAIL` (e.g. `hello@tehillahdigital.co.uk`)
   - `CONTACT_FROM_EMAIL` (the address you verified in SendGrid)
3. Save. No redeploy needed — the function reads these at runtime.

Until these are set, the form still works for visitors: it falls back to
opening their email client with a pre-filled message to
`hello@tehillahdigital.co.uk`, so no enquiry is lost.

### 5. Add real spam/bot protection (CAPTCHA)
The form already has a hidden honeypot field (`companyWebsite`) that
quietly rejects simple bots at the API level — no visible CAPTCHA, no
friction for real visitors. For stronger protection against determined
spam:
1. Create a free [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
   site (no Cloudflare DNS migration required — it works as a drop-in
   widget on any domain).
2. Add the Turnstile script tag and widget `div` to the form in
   `contact.html`, and send the returned token to `/api/contact`.
3. In `api/contact/index.js`, verify that token server-side against
   Cloudflare's `siteverify` endpoint before sending the email, rejecting
   the submission if verification fails.
This is a deploy-time integration task (it needs a live domain to issue
Turnstile keys against), so it isn't wired up in this static build.

### 6. TLS / SSL
No action needed — Azure Static Web Apps automatically provisions and
renews a free TLS certificate for both the default `*.azurestaticapps.net`
hostname and any custom domain you validate in step 3, and redirects
HTTP to HTTPS. This satisfies the brief's "SSL/TLS enforced" requirement
without extra configuration.

---

## Option B — Azure Storage static website + Front Door/CDN

If you'd rather not use GitHub Actions, you can host the static files
directly in Blob Storage:

1. Create a **Storage account** → enable **Static website** (under
   *Data management*) → set index document to `index.html` and error
   document to `index.html` (so client-side anchors work).
2. Upload every file in this folder (except `.github/` and `api/`) to the
   generated `$web` container — via the Portal's upload button, or:
   ```bash
   az storage blob upload-batch -s . -d '$web' --account-name <youraccount>
   ```
3. Storage's static website endpoint doesn't support custom domains with
   free HTTPS on its own, so put **Azure Front Door** (or **Azure CDN**)
   in front of it, then add `www.tehillahdigital.co.uk` as a custom
   domain on the Front Door endpoint — Front Door issues the certificate
   for you.
4. The contact form's `/api/contact` route won't exist in this setup
   unless you separately deploy the function to an **Azure Functions**
   app and update the `fetch('/api/contact')` call in `script.js` to
   that function's full URL. Otherwise, the site's mailto fallback still
   works fine on its own.

This route is more moving parts for the same result, so Option A is the
better default unless you specifically need it.

---

## What to update before going live

- [ ] Replace `hello@tehillahdigital.co.uk` if you'd prefer a different
      inbox (search for it in `index.html` and `script.js`).
- [ ] Confirm the phone number and office postcode in the **Contact**
      section of `index.html` are correct and current.
- [ ] Add the company registration number in `terms.html` and the
      footer of `index.html`.
- [ ] Replace the placeholder dates in `privacy.html` / `terms.html` and
      have them reviewed — they're a starting point, not legal advice.
- [ ] Update `sitemap.xml` if you add further pages.
