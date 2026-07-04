# RoleDesk Application Companion

This Chrome/Edge Manifest V3 extension scans visible application fields and fills only answers that the user has reviewed in the popup. It never clicks Submit, handles passwords, or uploads files.

## Install locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select this `extension` folder.
4. Open an application form, click the RoleDesk extension, and choose **Scan form**.

The current version is a safe draft-filling scaffold. A future backend connection will generate answers from the saved résumé and job description, but the user approval and no-submit rules remain mandatory.
