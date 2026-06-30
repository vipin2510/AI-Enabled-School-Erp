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
  "Laptop preview": "लैपटॉप पूर्वावलोकन",
  "Switch to mobile view": "मोबाइल व्यू पर जाएँ",

  // ── Demo guided tour ──────────────────────────────────────────────
  "Tour": "टूर",
  "Next": "आगे",
  "Done": "हो गया",
  "Your 4 modules": "आपके 4 मॉड्यूल",
  "Switch between Fees, Academics, Library and Results from here anytime.":
    "यहाँ से कभी भी शुल्क, शैक्षणिक, पुस्तकालय और परिणाम के बीच स्विच करें।",
  "Fees at a glance": "एक नज़र में शुल्क",
  "Paid, unpaid and outstanding amounts for the current month.":
    "चालू माह के भुगतान, बकाया और शेष राशि।",
  "Export pending fees": "बकाया शुल्क निर्यात करें",
  "Download class-wise pending fees as a CSV in one click.":
    "एक क्लिक में कक्षावार बकाया शुल्क CSV के रूप में डाउनलोड करें।",
  "Collect a fee": "शुल्क जमा करें",
  "Let's open the fee-collection screen.": "आइए शुल्क-संग्रह स्क्रीन खोलें।",
  "Find a student": "छात्र खोजें",
  "Search by name, mobile or class, then take the payment and print a receipt.":
    "नाम, मोबाइल या कक्षा से खोजें, फिर भुगतान लें और रसीद प्रिंट करें।",
  "Now we're in the Academics module — attendance, students, classes and ID cards.":
    "अब हम शैक्षणिक मॉड्यूल में हैं — उपस्थिति, छात्र, कक्षाएँ और आईडी कार्ड।",
  "Today at a glance": "आज एक नज़र में",
  "Live headcount with today's present and absent counts.":
    "आज की उपस्थित और अनुपस्थित संख्या के साथ लाइव गिनती।",
  "Pick a range": "अवधि चुनें",
  "Toggle the view between day, week and month.":
    "दिन, सप्ताह और माह के बीच दृश्य बदलें।",
  "Attendance by class": "कक्षावार उपस्थिति",
  "Per-class attendance rates, at a glance.": "एक नज़र में कक्षावार उपस्थिति दर।",
  "Catalog totals — books issued, available and requested.":
    "सूची योग — जारी, उपलब्ध और अनुरोधित पुस्तकें।",
  "Recent activity": "हाल की गतिविधि",
  "A live feed of issues and returns.": "जारी और वापसी की लाइव फ़ीड।",
  "Book requests": "पुस्तक अनुरोध",
  "Log a title a student has asked the library to add.":
    "वह पुस्तक दर्ज करें जिसे जोड़ने के लिए छात्र ने कहा है।",
  "Pick a class and section to enter marks and print report cards.":
    "अंक भरने और रिपोर्ट कार्ड प्रिंट करने के लिए कक्षा और सेक्शन चुनें।",
  "Academic year": "शैक्षणिक वर्ष",
  "Everything stays scoped to the current academic year.":
    "सब कुछ चालू शैक्षणिक वर्ष तक सीमित रहता है।",
  "हिंदी / English": "हिंदी / English",
  "Switch the whole app between English and Hindi anytime.":
    "पूरे ऐप को कभी भी अंग्रेज़ी और हिंदी के बीच बदलें।",
  "That's the tour!": "यह रहा टूर!",
  "Explore freely — and exit the demo whenever you like.":
    "स्वतंत्र रूप से देखें — और जब चाहें डेमो से बाहर निकलें।",
};

export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  hi,
};

export function makeT(locale: Locale): TFunc {
  const dict = dictionaries[locale];
  return (key, vars) => interpolate(dict[key] ?? key, vars);
}
