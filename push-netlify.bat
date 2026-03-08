@echo off
echo Building and pushing to GitHub for Netlify deployment...
cd /d d:\OneDrive\Desktop\repos\financial-modelling-pro
echo.
echo Building the project...
call npm run build
if errorlevel 1 (
  echo Build failed!
  pause
  exit /b 1
)
echo.
echo Adding files to git...
git add .
echo.
echo Committing changes...
git commit -m "Convert to static site for Netlify deployment"
echo.
echo Pushing to GitHub...
git push -u origin main
echo.
echo Done! Netlify should automatically deploy the changes.
echo.
echo To add environment variables in Netlify:
echo 1. Go to Netlify Dashboard
echo 2. Select your site
echo 3. Go to Site Settings > Environment Variables
echo 4. Add: VITE_GEMINI_API_KEY = your_api_key
echo.
pause


