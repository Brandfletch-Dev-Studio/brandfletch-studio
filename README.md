# Brandfletch Dev Studio Website

Static website for Brandfletch Dev Studio. Built with vanilla HTML, CSS, and JS — no build step, no dependencies.

## Deploy to GitHub Pages

1. **Create a new repo on GitHub** named `brandfletch-studio` (or whatever you like)
2. Push these files to the repo:
   ```bash
   git init
   git add .
   git commit -m "Initial website"
   git branch -M main
   git remote add origin https://github.com/brandfletch/brandfletch-studio.git
   git push -u origin main
   ```
3. Go to the repo **Settings → Pages**
4. Under **Source**, select `main` branch and `/ (root)` folder
5. Save — your site will be live at `https://brandfletch.github.io/brandfletch-studio/` in a minute or two

## Customizing

### Projects
Edit `js/main.js` — the `projects` array at the top. Add, remove, or modify entries. Each project has:
- `tag` — category label (Web App, API, Tool, etc.)
- `title` — project name
- `desc` — short description
- `stack` — array of tech tags
- `link` — GitHub or live URL

### Colors
Edit the CSS variables at the top of `css/style.css` under `:root`.

### Contact Info
Update the email address and GitHub links in `index.html`.

### Favicon
Replace `assets/favicon.svg` with your own.

## Custom Domain (optional)
In GitHub Pages settings, add your custom domain under **Custom domain**. Add a `CNAME` file with your domain name if needed.
