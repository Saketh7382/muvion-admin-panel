# Muvion Frontend

React administration console for the Muvion control plane. The application uses live backend data by default; the seed dataset is available only when Demo Mode is explicitly enabled in **System & Engine Gateway**.

## Run locally

1. Start the control-plane API on `http://localhost:8000`.
2. Copy `.env.example` to `.env` if the API uses a different address.
3. Install and start the UI:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`. This port matches the control-plane default CORS configuration.

## Live workflows

The UI supports campaign listing/search and creation, project configuration, connector boundaries, target assets, trusted sources, search queries, selected-connector scans, scan progress/cancellation, cumulative Audience Pulse generation, live analysis progress, failed-analysis retry, and final report rendering.

The control-plane URL and optional administrative cooldown override key can be configured from the System page. Browser storage is used for these local operator settings. Never use a production administrative secret in an untrusted browser.

## Validation

```bash
npm run lint
npm run build
```
