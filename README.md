# GoalTrack

A self-contained Goal Setting & Tracking web application with separate Employee and Manager flows.

## Run

Open `index.html` in a browser.

If login does not work from a `file://` URL, run the local server:

```powershell
C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe server.mjs
```

Then open:

```text
http://127.0.0.1:5500
```

## Demo Accounts

- Employee: `emma@company.com` / `password123`
- Manager: `maria@company.com` / `password123`

## Included Flow

- Employee login and manager login are separate pages.
- Employees can create up to 8 goals.
- Each goal requires at least 10% weightage.
- Goals can only be submitted when total weightage is exactly 100%.
- Employees can upload PDF, image, or document attachments.
- Attachments are stored in `file_url` as browser data URLs and can be previewed or downloaded.
- Submitted goals become `Pending Approval`.
- Managers receive notifications when employees submit goals.
- Managers can open notifications, review employee goals, approve, or reject.
- Approved goals are locked from employee editing.

## Browser Database

This static version uses `localStorage` as the database.

Users:
- `id`
- `name`
- `email`
- `password`
- `role`

Goals:
- `id`
- `user_id`
- `title`
- `description`
- `target`
- `weightage`
- `file_url`
- `status`

Notifications:
- `id`
- `user_id`
- `message`
- `is_read`
- `created_at`
