# getting pointzeroone.ai live

**host:** cloudflare pages — free, unlimited bandwidth, fastest network in india
**publishing:** github → cloudflare, so pushes deploy themselves
**email:** cloudflare email routing, free

about 40 minutes, most of it waiting for dns.

three things only you can do: create the cloudflare account, create the github repo, and change the nameservers. i can drive the rest in your browser.

---

## step 1 — cloudflare account

**dash.cloudflare.com/sign-up** → email + password → free plan → verify the email.

*(i can't create accounts or handle passwords — this one's yours.)*

---

## step 2 — put the site on github

our linux sandbox isn't starting on your machine, so git from here won't work. github's web uploader does the job without git at all.

1. **github.com/new**
2. repository name: `pointzeroone`
3. public or private — both work with cloudflare. private is fine.
4. **don't** tick "add a README" — we already have one
5. **Create repository**
6. on the next screen click **uploading an existing file**
7. open `Desktop\cowork\0.01 Ecosystem`, select everything inside it *(ctrl+A)*, and drag it onto the page
   - drag the *contents*, not the folder itself — the html files must sit at the repo root
   - the `drawings` folder comes along with its images
8. commit message: `the site` → **Commit changes**

---

## step 3 — connect the repo to cloudflare

1. cloudflare dashboard → **Compute (Workers & Pages)**
2. **Create** → **Pages** tab → **Connect to Git**
3. authorise github, pick the `pointzeroone` repo
4. build settings — **this matters, the defaults are wrong for us:**

   | field | value |
   |---|---|
   | framework preset | **None** |
   | build command | **leave empty** |
   | build output directory | **/** |

5. **Save and Deploy**

live in ~30 seconds at `pointzeroone.pages.dev`. open it and check every page before we attach the real domain.

---

## step 4 — add the domain

1. in the pages project → **Custom domains** → **Set up a custom domain**
2. enter `pointzeroone.ai` → **Continue**
3. cloudflare says the domain isn't on your account yet — accept adding it, choose the **Free** plan
4. it scans your existing dns, then shows **two nameservers** like `xxx.ns.cloudflare.com` — **copy both**

before moving on: check **Domain List → MANAGE → Redirect Email** in namecheap. if any forwarding aliases are listed, write them down — we rebuild them in step 6. if the list is empty, nothing to save.

---

## step 5 — point namecheap at cloudflare

1. namecheap → **Domain List** → `pointzeroone.ai` → **MANAGE**
2. **Nameservers** → change `Namecheap BasicDNS` to **Custom DNS**
3. paste the two cloudflare nameservers
4. click the **green checkmark**

this is the one step that changes something already live. it's reversible — you can switch back to BasicDNS — but dns takes time to settle either way.

namecheap says up to 48 hours; usually 15–60 minutes. cloudflare emails you when the domain is active. https and the certificate happen automatically.

---

## step 6 — email on the domain

namecheap's forwarding stops working once nameservers move, but cloudflare's replacement is free and better.

1. cloudflare → your domain → **Email** → **Email Routing** → **Get started**
2. create an address: `hi@pointzeroone.ai` → forwards to your personal gmail
3. verify from the email cloudflare sends to that inbox
4. cloudflare offers to add the required MX and TXT records — **accept**

to *send* from that address, add it in gmail under Settings → Accounts → "Send mail as", using cloudflare's smtp details.

---

## after it's live

**publishing changes:** tell me what to change, i edit the files here. then upload the changed files to github the same way as step 2 — cloudflare rebuilds within a minute, on its own. no dragging folders at cloudflare ever again.

**worth doing eventually:** get the sandbox working, or use git locally, so the upload step becomes one command instead of a drag. the error was `HYPERVISOR_VIRT_DISABLED` — virtualisation is switched off in your bios, or windows' "Virtual Machine Platform" feature is off.

---

## what's in the folder

| file | why |
|---|---|
| `index / letter / drawings / apps / book .html` | the five pages |
| `style.css`, `app.js` | the design system and the brush engine |
| `drawings/` | the paintings |
| `favicon.svg` | the mark in the browser tab |
| `404.html` | a lost page in the same hand |
| `robots.txt`, `sitemap.xml` | so google finds all five pages |
| `_headers` | security headers, long caching on the drawings |
| `.gitignore` | keeps windows junk out of the repo |
| `README.md`, `GO-LIVE.md` | notes for you and for me |

## still placeholder

- substack, x and youtube links in every footer point at `#`
- the app store link on the apps page
- the newsletter form doesn't submit anywhere — it needs your substack embed
- the share image is `drawings/the-reach.jpeg`; worth making a proper 1200×630 one later
