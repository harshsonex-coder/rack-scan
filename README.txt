RACK SCANNER APP  (React, installable on your phone, no Play Store)
====================================================================

WHAT THIS APP DOES
  Login page   Sign in with your name and password. The app saves the login
               token on the phone, so you stay logged in.
  Racks page   List of all racks. Scan a rack barcode (camera, USB /
               Bluetooth scanner, or typing) or tap a rack cell.
  Rack page    Opens after the rack is found. Scan product SKUs one by one;
               each scan calls POST api/warehouse-instock/scan-product-barcode.
               Scanning another rack barcode sends you back to the Racks page.
  Logout       Button at the top right. It removes the saved token and shows
               the login page again. If the server ever answers "not logged
               in" (401), the app logs out by itself.

  API address is already set everywhere:
     https://background-onlinefayda-api.3stage.in

--------------------------------------------------------------------------
!! CHECK THESE FIRST (the app could not be tested with your server)
--------------------------------------------------------------------------
1. LOGIN PATH.  I did not have your login API, so I guessed  api/login
   and the form sends  { email, password }.
   If login says "Login address not found (404)", open
        src/lib/config.ts
   and change LOGIN_PATH to your real login path. Then build again.

2. TOKEN NAME.  The app looks for  token / access_token / accessToken
   (also inside "data"). If your API names it differently, the login screen
   will show the field names it received. Send them to Claude to fix.

3. CORS.  This app runs on its own address (for example
   https://myrack.netlify.app). Your API server must allow that address
   (Access-Control-Allow-Origin). If not, you see "Cannot reach the server".
   Ask your backend developer to allow it.

4. COOKIE LOGIN.  If your website logs in with cookies (no token), set
   USE_COOKIES = true in src/lib/config.ts. The server must then also allow
   cookies from this app (CORS credentials).

--------------------------------------------------------------------------
PART 1 - Build the app (on a Windows / Mac PC, one time)
--------------------------------------------------------------------------
1. Install Node.js (the "LTS" button):  https://nodejs.org
2. Unzip this folder. Open it, then open a terminal in it:
     Windows: click the address bar of the folder, type  cmd  and press Enter
     Mac:     right-click the folder > "New Terminal at Folder"
3. Run these two commands, one by one (wait for each to finish):
     npm install
     npm run build
4. A new folder named  dist  appears. That is your finished app.

--------------------------------------------------------------------------
PART 2 - Put it online (free, gives the https link the camera needs)
--------------------------------------------------------------------------
1. Open  https://app.netlify.com/drop  and sign up free.
2. Drag the  dist  folder onto the page.
3. You get a link like  https://something.netlify.app

--------------------------------------------------------------------------
PART 3 - Install on your phone
--------------------------------------------------------------------------
1. On your Android phone open the link in CHROME.
2. Chrome menu (3 dots) > "Install app"  (or "Add to Home screen").
3. Open the app, log in, allow the camera, and start scanning.

--------------------------------------------------------------------------
TIPS
--------------------------------------------------------------------------
* Hold the barcode 10-15 cm from the camera. Use Flash in low light.
* If you change any code later, run  npm run build  again and drag the new
  dist folder to the same Netlify site. The phone app updates itself.
* To use your own logo, put it in the  public  folder and change the
  Warehouse icon in src/pages/LoginPage.tsx to an <img> tag.
* On iPhone use Safari > Share > "Add to Home Screen" (scanning is slower).

--------------------------------------------------------------------------
FOLDER MAP
--------------------------------------------------------------------------
  src/lib/config.ts                 API address, login path  <- change here
  src/lib/auth.ts                   login request and token handling
  src/lib/token.ts                  save / remove the token (logout)
  src/lib/axios.ts                  API connection (adds token to requests)
  src/pages/LoginPage.tsx           login screen
  src/pages/InstockPage.tsx         racks list + scan rack
  src/pages/RackDetailsPage.tsx     scan SKUs (calls the API)
  src/components/BarcodeScanner.tsx the camera scanner
  vite.config.ts                    app name, icon, install settings
