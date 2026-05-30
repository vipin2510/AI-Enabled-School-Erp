# Image Hosting Guide — Google Drive

The ERP stores **links** to photos, not the photos themselves. Every photo
goes on Google Drive, you copy the sharable link, and paste that link into
the CSV. This keeps the ERP fast and your school's Drive remains the source
of truth for the originals.

## One-time Drive setup

1. Create a Drive folder for the school, e.g.
   `Adeshwar - Kondagaon - 2026-27`.
2. Inside it, create sub-folders:
   ```
   students/
       profiles/      ← student face photos
       parents/       ← parent photos
   staff/
       profiles/
   ```
3. **Share each sub-folder** as *Anyone with the link* → *Viewer*.
   Without this, the ERP can't render the image and ID cards will be blank.

## Naming convention

Always name the file after the admission number (students) or phone number
(staff). This makes mis-pasted links easy to catch by eye.

- Student profile: `K-2026-0142.jpg`
- Student father:  `K-2026-0142-F.jpg`
- Student mother:  `K-2026-0142-M.jpg`
- Staff profile:   `9876543210.jpg`

Where `K-2026-0142` is the student's admission number.

## Getting the sharable link

1. Right-click the image → **Share**.
2. Make sure the access is *Anyone with the link → Viewer*.
3. Click **Copy link**.
4. The link looks like:
   `https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing`
5. Paste this **whole link** into the CSV — the ERP extracts the file id and
   renders the image. Do not shorten it.

## DO

- ✅ Compress before uploading. JPG, max 2 MB, 1080 px on the long side.
- ✅ Use the school's official Drive account, not a personal Gmail.
- ✅ Keep the original folder structure intact after handover — the ERP
      keeps using these links forever (until you re-upload).
- ✅ Spot-check 10 random links before submitting: open each in an incognito
      window and confirm the right photo loads.
- ✅ Use `.jpg` or `.png`. HEIC files from iPhones do not render.

## DON'T

- ❌ Don't upload PDFs of photos. Export the JPG/PNG and upload that.
- ❌ Don't set the Drive sharing to *Restricted* or *Specific people only* —
      the ERP server is anonymous from Drive's perspective.
- ❌ Don't move or rename files after pasting links into the CSV. The link
      keeps working but the filename hint becomes wrong, and the next person
      can't tell which photo is which.
- ❌ Don't paste a *folder* link in a per-student row. One link per image,
      always.
- ❌ Don't use WhatsApp Web's downloaded images directly — they're often
      `.jfif` and the ERP rejects them. Re-save as `.jpg`.
- ❌ Don't put images in `Shared with me` — keep them inside the school's
      own Drive so a future audit can find them.

## When in doubt

Open the link in an **incognito browser tab while signed out of Google**. If
the image loads there, the ERP can load it too. If you see a "Request access"
screen, the sharing setting is wrong.
