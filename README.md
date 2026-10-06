# 🚀 HireMind AI
**An Explainable, Fair, and Adaptive AI-Powered Candidate Evaluation Platform**

![HireMind Banner](https://via.placeholder.com/1200x300?text=HireMind+AI+-+Explainable,+Fair+%26+Adaptive+Platform)

HireMind AI is a state-of-the-art, developmental candidate evaluation platform built with the MERN stack. It integrates powerful AI models, real-time code execution, and strict AI proctoring with explainable scoring, skill gap analysis, and fairness auditing to revolutionize the hiring process.

## ✨ Features
*   **AI Resume Intelligence:** Automatically extract skills, experience, and projects to build a personalized candidate profile.
*   **Adaptive AI Interviews:** Dynamic question generation and follow-ups based on the candidate's previous responses.
*   **Real-Time Coding Evaluation:** Integrated Monaco Editor with Judge0 sandbox for secure code compilation and intelligent AI analysis.
*   **Strict AI Proctoring:** Client-side face tracking, object detection (phones/tablets), and tab-switching alerts using TensorFlow.js and MediaPipe.
*   **Explainable Evaluation:** Transparent scoring metrics that show exactly what drove a candidate's score.
*   **Fairness Audit:** Post-hoc fairness measurements to ensure equitable evaluation without demographic bias.
*   **Personalized Skill Roadmaps:** Generates practical, step-by-step improvement plans for candidates based on skill gap analysis.

## 🏗 System Architecture

```text
                    ┌─────────────────────┐
                    │    Job / Resume     │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │ Skill Extraction &  │
                    │ Candidate Profiling │
                    └──────────┬──────────┘
                               ↓
              ┌────────────────┴────────────────┐
              ↓                                 ↓
      AI Video / HR Interview            Live Coding / DSA
              ↓                                 ↓
      Adaptive Follow-ups                 Judge0 Evaluation
              └────────────────┬────────────────┘
                               ↓
                     ┌──────────────────┐
                     │ Evidence Engine  │
                     └────────┬─────────┘
                              ↓
                ┌─────────────┴─────────────┐
                ↓                           ↓
        Explainable Score             Skill Gap Analysis
                ↓                           ↓
        SHAP / Feature Factors       Missing Competencies
                └─────────────┬─────────────┘
                              ↓
                     Fairness Audit
                              ↓
                     Human Recruiter
                              ↓
                   Candidate Roadmap
                              ↓
                 Personalized Development
```

## 🖼️ Preview / Demo

| AI Interview Dashboard | Live Coding Sandbox |
|:---:|:---:|
| ![Dashboard](https://via.placeholder.com/600x350?text=Analytics+Dashboard) | ![Coding](https://via.placeholder.com/600x350?text=Live+Monaco+Editor) |

| Strict AI Proctoring | Follow-up Discussion |
|:---:|:---:|
| ![Proctoring](https://via.placeholder.com/600x350?text=Face+%26+Phone+Detection) | ![FollowUp](https://via.placeholder.com/600x350?text=AI+Voice+Discussion) |

## 🚀 Live Demo
`[Add live demo URL]`

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19 & Vite** | Fast, modern frontend framework and build tool |
| **Tailwind CSS v4** | Utility-first styling for responsive design |
| **Redux Toolkit** | Global state management |
| **Node.js & Express.js** | Robust backend API and business logic |
| **MongoDB & Mongoose** | NoSQL database and object data modeling |
| **Groq API / OpenAI** | High-performance LLMs for evaluation and dynamic questions |
| **TensorFlow.js / MediaPipe**| Client-side AI proctoring, vision, and audio tasks |
| **Monaco Editor / Judge0** | In-browser IDE and secure sandboxed code execution |
| **Firebase** | Authentication and real-time backend services |
| **Razorpay** | Secure payment gateway integration |

## 📦 Installation

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [MongoDB](https://www.mongodb.com/) (Local or Atlas)
*   API Keys (Groq, RapidAPI/Judge0, Razorpay, Firebase)

### Clone the Repository
```bash
git clone https://github.com/sumitShahi255/SmartHire_AI.git
cd SmartHire_AI
```

### Install Dependencies
**1. Install Client Dependencies**
```bash
cd client
npm install
```

**2. Install Server Dependencies**
```bash
cd ../server
npm install
```

## ⚡ Quick Start

Start the application by running the frontend and backend servers simultaneously.

**Start the Backend API:**
```bash
cd server
npm run dev
```
*Server runs on http://localhost:8000*

**Start the Frontend Client:**
```bash
cd client
npm run dev
```
*Client runs on http://localhost:5173*

## ⚙️ Configuration / Environment Variables

Create a `.env` file in both the `client` and `server` directories based on the templates below.

### Server (`server/.env`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `PORT` | API server port | Yes | `8000` |
| `MONGODB_URL` | MongoDB connection string | Yes | `mongodb+srv://...` |
| `JWT_SECRET` | Secret for JWT token generation | Yes | `your_jwt_secret` |
| `groq_API_KEY` | Groq API Key for LLM services | Yes | `gsk_...` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | Yes | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret | Yes | `...` |
| `RAPID_API_KEY` | RapidAPI Key for Judge0 | Yes | `...` |
| `OPENAI_API_KEY` | OpenAI API Key (if used as fallback) | No | `sk-...` |

### Client (`client/.env`)

| Variable | Description | Required | Example |
|---|---|---|---|
| `VITE_FIREBASE_APIKEY` | Firebase API Key | Yes | `AIzaSy...` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Key ID for client payment flow | Yes | `rzp_test_...` |

## 📁 Project Structure

```text
SmartHire_AI/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── assets/         # Static assets and media
│   │   ├── components/     # Reusable UI components
│   │   ├── data/           # Mock data and constants
│   │   ├── pages/          # Application route pages
│   │   ├── redux/          # Redux slices and store configuration
│   │   └── utils/          # Helper functions and configurations
│   ├── package.json
│   └── vite.config.js
└── server/                 # Backend Node.js/Express API
    ├── backup/             # Database backups
    ├── config/             # Database and service configurations
    ├── controllers/        # Request handlers and business logic
    ├── middlewares/        # Custom Express middlewares (Auth, etc.)
    ├── models/             # Mongoose database schemas
    ├── routes/             # API route definitions
    ├── services/           # External API integrations (LLMs, Payment)
    ├── utils/              # Backend helper utilities
    ├── index.js            # Server entry point
    └── package.json
```

## 💻 Usage

1. **Candidate Onboarding:** Candidates register and upload their resumes for automatic skill extraction.
2. **AI Interviews:** Candidates undergo adaptive AI-driven interviews where questions evolve based on their answers.
3. **Coding Assessments:** Candidates solve DSA problems in a live IDE (Monaco Editor) while being monitored by AI proctoring (webcam, face tracking, and screen focus).
4. **Evaluation:** Recruiters receive an explainable evaluation report highlighting strengths, skill gaps, and a personalized candidate roadmap.

## 🔌 API Documentation

*Core backend routes structure:*

| Module | Purpose |
|---|---|
| `/api/auth` | Login, Signup, Google OAuth, and JWT verification. |
| `/api/coding-interview` | Fetch coding questions, execute code via Judge0, and submit for AI grading. |
| `/api/interview` | Handle video uploads and voice-to-text response AI evaluation. |
| `/api/payment` | Razorpay order creation and payment verification. |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

`[Add license information]`

## 👨‍💻 Author

**Sumit Shahi**
- [GitHub](https://github.com/sumitShahi255)

## ⭐ Support

If you found this project helpful, please give it a ⭐️ on GitHub!
