import { interpolate, type Locale, type TFunc } from "./config";

// Hindi (Devanagari) translations, keyed by the exact English source string.
// Missing entries fall back to English automatically — so this can be filled
// in incrementally without breaking any screen. Keep placeholders ({name})
// identical to the English source.
export const hi: Record<string, string> = {
  // ── Navigation / departments / roles ──────────────────────────────
  "Overview": "अवलोकन",
  "Dashboard": "डैशबोर्ड",
  "Fee Structures": "शुल्क संरचना",
  "Collect Fee": "शुल्क जमा करें",
  "Expenses": "व्यय",
  "Receipts": "रसीदें",
  "Settings": "सेटिंग्स",
  "Print Layout": "प्रिंट लेआउट",
  "Students": "विद्यार्थी",
  "Attendance": "उपस्थिति",
  "Classes & Sections": "कक्षाएँ और अनुभाग",
  "Subjects": "विषय",
  "Timetable": "समय-सारणी",
  "ID Cards": "पहचान पत्र",
  "Administration": "प्रशासन",
  "Users & Logins": "उपयोगकर्ता और लॉगिन",
  "Staff Attendance": "कर्मचारी उपस्थिति",
  "Change Requests": "परिवर्तन अनुरोध",
  "Fees": "शुल्क",
  "Academics": "शैक्षणिक",
  "Library": "पुस्तकालय",
  "Results": "परिणाम",
  "Admin": "व्यवस्थापक",
  "Manager": "प्रबंधक",
  "Staff": "कर्मचारी",

  // ── Topbar ────────────────────────────────────────────────────────
  "School": "विद्यालय",
  "Department": "विभाग",
  "Sign out": "साइन आउट",
  "Mark Attendance": "उपस्थिति दर्ज करें",
  "Marking…": "दर्ज हो रहा है…",
  "Marked": "दर्ज किया गया",
  "Language": "भाषा",

  // ── Common actions / words ────────────────────────────────────────
  "Save": "सहेजें",
  "Saving…": "सहेजा जा रहा है…",
  "Cancel": "रद्द करें",
  "Delete": "हटाएँ",
  "Edit": "संपादित करें",
  "Add": "जोड़ें",
  "Search": "खोजें",
  "Back": "वापस",
  "Download PDF": "PDF डाउनलोड करें",
  "Preview": "पूर्वावलोकन",
  "Loading…": "लोड हो रहा है…",
  "No results.": "कोई परिणाम नहीं।",

  // ── Login ─────────────────────────────────────────────────────────
  "Sign in": "साइन इन करें",
  "Signing in…": "साइन इन हो रहा है…",
  "Password": "पासवर्ड",
  "Invalid credentials.": "अमान्य क्रेडेंशियल।",
  "You were signed out after 15 minutes of inactivity. Please sign in again.":
    "15 मिनट की निष्क्रियता के बाद आपको साइन आउट कर दिया गया। कृपया पुनः साइन इन करें।",

  // ── Library issue/return desk ─────────────────────────────────────
  "Issue to student": "विद्यार्थी को जारी करें",
  "Book number, code, or title": "पुस्तक संख्या, कोड या शीर्षक",
  "Look up": "खोजें",
  "Looking up…": "खोजा जा रहा है…",
  "Lookup failed.": "खोज विफल रही।",
  "📷 Scan QR": "📷 QR स्कैन करें",
  "Stop camera": "कैमरा बंद करें",
  "Issued": "जारी",
  "Available": "उपलब्ध",
  "↩ Collect book": "↩ पुस्तक वापस लें",
  "📕 Issue": "📕 जारी करें",
  "Search student by name or admission no.…": "नाम या प्रवेश संख्या से विद्यार्थी खोजें…",
  "Could not start the camera. Type the code instead.":
    "कैमरा शुरू नहीं हो सका। इसके बजाय कोड टाइप करें।",
  "Pick a book and a student.": "एक पुस्तक और एक विद्यार्थी चुनें।",
  "No book found for that number.": "उस संख्या के लिए कोई पुस्तक नहीं मिली।",
  "This book is already issued.": "यह पुस्तक पहले से जारी है।",
  "This book is not currently issued.": "यह पुस्तक वर्तमान में जारी नहीं है।",
  "Type or scan the book’s number, code, or title and press":
    "पुस्तक की संख्या, कोड या शीर्षक टाइप या स्कैन करें और दबाएँ",
  "We’ll figure out if it needs to be issued or collected.":
    "हम पता लगा लेंगे कि इसे जारी करना है या वापस लेना है।",
  "{count} matches — pick the right book:": "{count} मिलान — सही पुस्तक चुनें:",
  "Held by": "के पास",
  "← Back to {count} matches": "← {count} मिलानों पर वापस जाएँ",
  "This book is marked {status}.": "यह पुस्तक {status} के रूप में चिह्नित है।",
  "No book found for “{code}”.": "“{code}” के लिए कोई पुस्तक नहीं मिली।",

  // ── Demo sandbox ──────────────────────────────────────────────────
  "See Demo": "डेमो देखें",
  "Who is this demo for?": "यह डेमो किसके लिए है?",
  "For an institute": "संस्थान के लिए",
  "For a parent": "अभिभावक के लिए",
  "Coming soon": "जल्द आ रहा है",
  "How do you want to view it?": "आप इसे कैसे देखना चाहते हैं?",
  "View on laptop": "लैपटॉप पर देखें",
  "View on mobile": "मोबाइल पर देखें",
  "Mobile preview": "मोबाइल पूर्वावलोकन",
  "Switch to laptop view": "लैपटॉप व्यू पर जाएँ",
  "Exit demo": "डेमो से बाहर निकलें",
  "Demo — data is temporary": "डेमो — डेटा अस्थायी है",
};

export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  hi,
};

export function makeT(locale: Locale): TFunc {
  const dict = dictionaries[locale];
  return (key, vars) => interpolate(dict[key] ?? key, vars);
}
