# Onboarding Checklist — per School

Print one copy per school. Tick boxes as you go. Hand the completed folder
back to the implementation admin.

> Convert this file to PDF with `Cmd/Ctrl + P → Save as PDF` in any markdown
> viewer (VS Code, Obsidian, Typora) if you need a printable hard copy.

## 1. School identity (already done — verify only)

- [ ] School name, location, and board code in the ERP match your letterhead.
      If anything is wrong, raise it with the implementation admin before
      starting data entry — fixing it later means re-issuing receipts.

## 2. Classes & sections

- [ ] `classes.csv` — one row per class the school **actually runs this year**.
- [ ] `sections.csv` — one row per section per class. Skip if a class has only
      one section.
- [ ] `subjects.csv` — one row per subject per class. Mark co-curricular
      subjects (Art, Music, PT) with `co_curricular = yes`.

## 3. Students

- [ ] `students.csv` — one row per student.
- [ ] Admission numbers are unique and follow your existing format.
- [ ] Class and section spellings match `classes.csv` / `sections.csv` exactly.
- [ ] Mobile numbers are 10 digits, no `+91`, no spaces, no dashes.
- [ ] Date of birth is `DD-MM-YYYY` (matches CISCE registration format).
- [ ] Profile photo links pasted in `profile_image_url`. See IMAGE-GUIDE.md.
- [ ] Father/mother photo links pasted in `father_image_url` /
      `mother_image_url`. Leave blank if not collected.

## 4. Staff (and their logins)

- [ ] `staff.csv` — one row per staff member who needs a login.
- [ ] Phone numbers are 10 digits and unique (this is their **login
      username** — no two staff can share a phone).
- [ ] `role` is one of `admin`, `manager`, `staff`.
- [ ] `department` filled for `staff` rows only (one of `fees`, `academics`,
      `library`, `results`). Leave blank for `admin` / `manager`.
- [ ] `initial_password` is set. Each staff member is told to change it on
      first login.

## 5. Fees

- [ ] `fee-structures.csv` — one row per (class × academic year × scope).
      Scope is `school` or `hostel`.
- [ ] `fee-components.csv` — line items inside each structure. Yearly fee,
      monthly fee, registration, caution, admission one-time.
- [ ] Component totals add up to the structure total amount.

## 6. Library (optional — skip if not using the library module)

- [ ] `books.csv` — one row per **copy** (so a 5-copy title is 5 rows, each
      with its own `code`).
- [ ] `library-settings.csv` — single row with the school's loan rules.

## 7. Images on Drive

- [ ] All photo folders shared as **"Anyone with the link can view"**.
- [ ] File naming follows admission number (e.g. `K-2026-0142.jpg`).
- [ ] No image exceeds **2 MB**. Compress with [tinypng.com](https://tinypng.com)
      if larger.
- [ ] The shared link in each CSV row opens the **correct** photo (spot-check
      10 random rows).

## 8. Hand-off

- [ ] All CSVs in the school's folder have data, not just headers.
- [ ] No CSV has a row where every cell is empty.
- [ ] No special characters in the CSV beyond standard Hindi/English text
      (avoid smart-quotes from Word — paste through a plain text editor).
- [ ] Filed with the implementation admin: this completed checklist + the
      full school folder.
