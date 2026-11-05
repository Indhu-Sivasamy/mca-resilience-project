# Deploying the project as a real website (Render, free plans)

Result: a public website (frontend), a backend API and a PostgreSQL database, all on Render.

## One-time preparation
1. Create a free account on github.com and install Git (git-scm.com).
2. Create a new EMPTY repository on GitHub (private is fine).
3. In the project folder (the one containing server, client and render.yaml), run:
   git init
   git add .
   git commit -m "Resilience project"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
   git push -u origin main
   The .gitignore file keeps your .env files (and your database password) out of GitHub.

## Deploy
1. Create a free account on render.com and sign in with GitHub.
2. New, then Blueprint, pick your repository, and continue.
3. Render shows the values it needs:
   - ADMIN_PASSWORD and VIEWER_PASSWORD: choose strong passwords of your own.
   - FRONTEND_URL: https://mca-resilience-app.onrender.com
   - VITE_API_URL:  https://mca-resilience-api.onrender.com
   (If you renamed the services in render.yaml, use your names. If Render says a name is taken, it adds a suffix; fix the two URLs in step 5.)
4. Check every service and the database say Free, then click Apply. The first build takes 5 to 10 minutes.
5. When the services are live, open each one in the Render dashboard and note its real URL.
   - API service, Environment: FRONTEND_URL must equal the website's URL (no slash at the end).
   - Website service, Environment: VITE_API_URL must equal the API's URL.
   If you changed either value, save it, then use Manual Deploy on the website service (its value is baked in at build time). The API restarts by itself.
6. Open the website URL and sign in as admin@demo.com with your ADMIN_PASSWORD. On the first start the API creates the tables, loads the demo data and scores it.

## Things to know
- A free API goes to sleep after 15 minutes without traffic. The first visit then takes up to a minute. Open the site 5 minutes before a demo.
- The free database expires 30 days after creation (14 days grace). If it expires, create a new one; the API reloads the demo data by itself on an empty database.
- The demo data is generated. Anyone with the link can see the login page, so use strong passwords and share the viewer account only.
- Changes you push to GitHub redeploy automatically.

## Troubleshooting
- Login says "Failed to fetch": VITE_API_URL is wrong, or the API is still waking up. Check the API logs on Render.
- Browser console shows a CORS error: FRONTEND_URL on the API does not match the website URL exactly.
- API log says the server does not support SSL: add DATABASE_SSL=false to the API environment.
- API log says "Set ADMIN_PASSWORD and VIEWER_PASSWORD": fill in both on the API service and redeploy.
- Refreshing a page like /region/3 shows 404: the rewrite rule in render.yaml (/* to /index.html) is missing.
