# Dhruvil Gohil Portfolio

A static portfolio built with HTML, CSS, and Three.js. The site has no package installation, build step, server process, or environment variables.

## Preview locally

From this folder, serve the site over HTTP:

```powershell
py -m http.server 4178 --bind 127.0.0.1 --directory dist
```

Open [localhost:4178](http://127.0.0.1:4178). On systems without the Windows `py` launcher, use `python -m http.server` with the same options. The hero imports browser modules, so serve the page over HTTP instead of opening the HTML file directly.

## Deploy to Render

Once this project is pushed to your GitHub repository, connect the repository as a **New → Blueprint** in Render. The included `render.yaml` declares a static site backed by `dist`. Render assigns the public URL when the service is created.

For manual setup, choose **New → Static Site** and select the repo and branch. Leave **Root Directory** blank when the project is at the repository root, set **Build Command** to `true`, and set **Publish Directory** to `dist`.

See [Render Static Sites](https://render.com/docs/static-sites) and the [Blueprint specification](https://render.com/docs/blueprint-spec#static-sites).

## Edit the site

- `dist/index.html` holds the written content and project links.
- `dist/styles.css` holds the layout, typography, and responsive styles.
- `dist/project-media.css` styles the selected project previews.
- `dist/wallpaper.mjs` renders the live backdrop, which responds to pointer movement and scroll position.
- `dist/hero.mjs` contains the Three.js hero. Both scenes have CSS fallbacks when WebGL is unavailable.
- `dist/motion.mjs` shares one pause control across both scenes, remembers the setting, and respects system reduced-motion preferences.
- `dist/assets` contains the local artwork and font. `dist/vendor` includes the locally served Three.js modules and license.

See [project artwork attribution](ASSET-CREDITS.txt) for sources and licenses.
