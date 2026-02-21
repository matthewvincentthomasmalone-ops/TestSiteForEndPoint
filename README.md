diff --git a/README.md b/README.md
index 3603afa227c80300e10ed76fe692b0ee68bf285a..197656413df655849ff6abcf784b6b41589c0fd1 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,44 @@
 # PhoneBoxEndPoint
-Endpoint Host
+
+Static single-page **Virtual Endpoints Phonebox** UI for answering and monitoring call routing events.
+
+## Deploy to GitHub Pages
+
+1. Push this repository/branch to GitHub.
+2. In GitHub, open **Settings → Pages**.
+3. Under **Build and deployment**, choose **Deploy from a branch**.
+4. Select your branch and `/ (root)` folder, then save.
+5. Wait for the Pages build to complete and open your published URL.
+
+## Backend configuration
+
+The frontend is static and calls the backend defined in `app.js`:
+
+- `BACKEND_BASE_URL`
+- `WS_URL` (derived as `wss://.../ws`)
+- `ANSWER_API_URL` (derived as `https://.../api/answer`)
+
+Update `BACKEND_BASE_URL` in `app.js` if you move environments.
+
+## Pre-deploy checklist
+
+- [ ] Backend is reachable via HTTPS.
+- [ ] WebSocket endpoint is reachable via WSS.
+- [ ] Backend CORS allows your GitHub Pages origin.
+- [ ] `POST /api/answer` accepts JSON: `{ endpointNumber, callSid }`.
+- [ ] WebSocket events include: `eventType`, `endpointNumber`, `callSid`, `timestamp`.
+- [ ] Twilio endpoint numbers match the numbers configured in `app.js`.
+
+## Quick smoke test after deploy
+
+1. Open browser DevTools on the published Pages URL.
+2. Confirm no 404s for `styles.css` and `app.js`.
+3. Confirm WebSocket connects (no repeated close/retry errors).
+4. Trigger a test ring event from backend and verify tile state changes to **Ringing**.
+5. Click the ringing tile and verify a successful `POST /api/answer`.
+6. Verify event log updates and status transitions (`Ringing` → `Answering` → `Answered`/`Completed`).
+
+## Notes
+
+- This frontend does **not** implement Twilio server logic; it only renders event state and sends answer actions.
+- Ring audio may require user interaction before playback due to browser autoplay policies.
