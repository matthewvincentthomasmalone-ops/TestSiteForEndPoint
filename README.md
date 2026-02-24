# PhoneBoxEndPoint

Static single-page **Virtual Endpoints Phonebox** UI for answering and monitoring call routing events.

## Deploy to GitHub Pages

1. Push this repository/branch to GitHub.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your branch and `/ (root)` folder, then save.
5. Wait for the Pages build to complete and open your published URL.

## Environment Variables
To run this project, you will need to add the following variables to your Vercel project settings:

 `UPSTASH_URL`: Your Upstash REST URL
 `UPSTASH_TOKEN`: Your Upstash REST Token
 `TWILIO_ACCOUNT_SID`: Your Twilio SID
 `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token

## Backend configuration

The frontend is static and calls the backend defined in `app.js`:

- `BACKEND_BASE_URL`
- `ANSWER_API_URL` (derived as `https://.../api/answer`)
- `PASS_API_URL` (derived as `https://.../api/pass`)

## Pre-deploy checklist

- [x] Backend is reachable via HTTPS.
- [x] Backend CORS allows your GitHub Pages origin.
- [x] `POST /api/answer` accepts JSON: `{ endpointNumber, callSid }`.
- [x] `POST /api/pass` accepts JSON: `{ endpointNumber, callSid }`.
- [x] Twilio endpoint numbers match the numbers configured in `app.js`.

---
