import React, { useState, useRef, useEffect } from "react";
import "./HRChatbot.css";

/* ── Initial quick replies ── */
const INITIAL_QUICK_REPLIES = [
  "How many casual leaves do I get?",
  "What is the sick leave policy?",
  "How do I apply for leave?",
  "What are the office working hours?",
  "How is salary calculated?",
  "What is the WFH policy?",
];

/* ── HR FAQ ── */
const HR_FAQ = [
  {
    intent: "salary",
    keywords: ["salary", "credited", "payment", "pay", "income", "salary date"],
    answer: "Salary is credited on the last working day of each month via bank transfer.",
  },
  {
    intent: "payslip",
    keywords: ["payslip", "salary slip", "slip", "payroll", "download payslip"],
    answer: "You can view and download your payslip from the payroll section in the HRMS portal.",
  },
  {
    intent: "leave",
    keywords: ["leave", "casual leave", "sick leave", "holiday", "vacation", "leave balance"],
    answer: "Employees get 12 casual leaves per year (1 per month). Leaves cannot be carried forward.",
  },
  {
    intent: "apply_leave",
    keywords: ["apply leave", "request leave", "leave apply", "how to apply leave"],
    answer: "You can apply for leave through the HRMS portal under the Leave section.",
  },
  {
    intent: "leave_status",
    keywords: ["leave status", "approved leave", "leave approval"],
    answer: "You can check your leave status in the HRMS portal under Leave History.",
  },
  {
    intent: "working_hours",
    keywords: ["working hours", "office timing", "timing", "shift", "hours"],
    answer: "Working hours are 9:00 AM to 6:00 PM, Monday to Friday.",
  },
  {
    intent: "wfh_policy",
    keywords: ["wfh", "work from home", "remote work"],
    answer: "Work From Home is allowed based on manager approval and company policy.",
  },
  {
    intent: "attendance",
    keywords: ["attendance", "mark attendance", "check in", "check out"],
    answer: "You can mark your attendance daily through the HRMS dashboard.",
  },
  {
    intent: "holidays",
    keywords: ["holiday list", "holidays", "public holidays", "festival holidays"],
    answer: "You can view the holiday list in the HRMS portal under the Holidays section.",
  },
  {
    intent: "deductions",
    keywords: ["deduction", "salary deduction", "pf", "tax", "esi"],
    answer: "Salary deductions may include PF, tax, and other applicable contributions.",
  },
  {
    intent: "bonus",
    keywords: ["bonus", "incentive", "performance bonus"],
    answer: "Bonuses are provided based on company performance and individual contribution.",
  },
  {
    intent: "increment",
    keywords: ["increment", "salary hike", "appraisal", "raise"],
    answer: "Salary increments are usually done during the annual appraisal cycle.",
  },
  {
    intent: "resignation",
    keywords: ["resign", "resignation", "notice period", "exit"],
    answer: "You can submit your resignation through the HRMS portal. The standard notice period is as per company policy.",
  },
  {
    intent: "notice_period",
    keywords: ["notice period", "serving notice", "exit notice"],
    answer: "The notice period depends on your role and is defined in your offer letter.",
  },
  {
    intent: "experience_letter",
    keywords: ["experience letter", "relieving letter"],
    answer: "Experience and relieving letters are provided after successful exit clearance.",
  },
  {
    intent: "documents",
    keywords: ["upload documents", "documents", "kyc", "submit documents"],
    answer: "You can upload and manage your documents in the HRMS profile section.",
  },
  {
    intent: "profile_update",
    keywords: ["update profile", "edit details", "change info"],
    answer: "You can update your personal details in the HRMS profile settings.",
  },
  {
    intent: "reimbursement",
    keywords: ["reimbursement", "claim", "expense claim"],
    answer: "You can submit reimbursement claims through the HRMS under the Expenses section.",
  },
  {
    intent: "insurance",
    keywords: ["insurance", "medical insurance", "health policy"],
    answer: "Employees are covered under the company’s health insurance policy as per eligibility.",
  },
  {
    intent: "id_card",
    keywords: ["id card", "employee id", "badge"],
    answer: "You can request or download your employee ID from the HRMS portal.",
  },
];

/* ── Smart Matching Function ── */
const findBestMatch = (input) => {
  const cleanInput = input.toLowerCase().replace(/[^\w\s]/gi, "");
  let bestMatch = null;
  let highestScore = 0;

  for (let item of HR_FAQ) {
    let score = 0;

    for (let keyword of item.keywords) {
      if (cleanInput.includes(keyword)) {
        score += keyword.length;
      } else {
        const words = cleanInput.split(" ");
        for (let word of words) {
          if (
            word.startsWith(keyword) ||
            keyword.startsWith(word)
          ) {
            score += 1;
          }
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return highestScore > 0 ? bestMatch : null;
};

const HRChatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your HR Assistant.\n\nAsk me about leave policies, salary, working hours, etc.",
    },
  ]);
  const [quickReplies, setQuickReplies] = useState(INITIAL_QUICK_REPLIES);
  const [input, setInput] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  /* ── Send Message ── */
  const sendMessage = (text) => {
    const userText = (text || input).trim();
    if (!userText) return;

    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setInput("");
    setQuickReplies([]);

    const match = findBestMatch(userText);

    const reply =
      match?.answer ||
      "Sorry, I can only answer HR-related questions like leave, salary, or working hours.";

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      const suggestionsMap = {
        salary: ["Payslip", "Deductions", "Salary date"],
        payslip: ["Download payslip", "Salary", "Deductions"],
        leave: ["Apply leave", "Leave balance"],
        working_hours: ["Leave policy", "WFH policy"],
      };

      setQuickReplies(
        match ? suggestionsMap[match.intent] || INITIAL_QUICK_REPLIES : INITIAL_QUICK_REPLIES
      );
    }, 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        className={`hr-chat-fab ${open ? "hr-chat-fab-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        💬
      </button>

      <div className={`hr-chat-panel ${open ? "hr-chat-panel-open" : ""}`}>
        <div className="hr-chat-header">
          <h3>HR Assistant</h3>
          <button onClick={() => setOpen(false)}>✖</button>
        </div>

        <div className="hr-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`hr-msg-${msg.role}`}>
              <div className="hr-msg-bubble">{msg.content}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {quickReplies.length > 0 && (
          <div className="hr-quick-replies">
            {quickReplies.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="hr-chat-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something..."
          />
          <button onClick={() => sendMessage()}>Send</button>
        </div>
      </div>
    </>
  );
};

export default HRChatbot;