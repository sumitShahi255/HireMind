# 🚀 HireMind AI

**An Explainable, Fair, and Adaptive AI-Powered Candidate Evaluation Platform**

HireMind AI is an AI-powered candidate evaluation platform built using the MERN stack. It combines AI-driven interviews, resume intelligence, real-time coding evaluation, strict AI proctoring, explainable scoring, fairness auditing, skill-gap analysis, and personalized development roadmaps to provide a comprehensive candidate assessment experience.

---

# Features

* AI-powered resume intelligence
* Automatic skill, experience, and project extraction
* Personalized candidate profiling
* Adaptive AI-generated interview questions
* Dynamic AI follow-up questions based on candidate responses
* AI video and HR interviews
* Real-time coding and DSA assessments
* Monaco Editor integration
* Judge0 sandbox-based code execution
* AI-powered coding evaluation
* Strict AI proctoring
* Real-time face tracking
* Phone and object detection
* Tab-switching detection and alerts
* Webcam-based interview monitoring
* Explainable candidate scoring
* Transparent evaluation metrics
* SHAP/feature-based scoring factors
* Skill-gap analysis
* Missing competency identification
* Fairness auditing
* Bias-aware candidate evaluation
* Personalized skill development roadmaps
* Recruiter-focused evaluation reports
* AI-generated candidate feedback
* Razorpay payment integration
* Firebase authentication
* JWT-based authentication
* Responsive modern UI
* Full-stack MERN architecture

---

# System Architecture

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
             ┌─────────────────┴─────────────────┐
             ↓                                   ↓
      AI Video / HR Interview             Live Coding / DSA
             ↓                                   ↓
      Adaptive Follow-ups                  Judge0 Evaluation
             └─────────────────┬─────────────────┘
                               ↓
                     ┌──────────────────┐
                     │  Evidence Engine │
                     └────────┬─────────┘
                              ↓
               ┌──────────────┴──────────────┐
               ↓                             ↓
       Explainable Score              Skill Gap Analysis
               ↓                             ↓
       SHAP / Feature Factors         Missing Competencies
               └──────────────┬──────────────┘
                              ↓
                       Fairness Audit
                              ↓
                       Human Recruiter
                              ↓
                     Candidate Roadmap
                              ↓
                   Personalized Development
```

---

# Preview / Demo

|                                AI Interview Dashboard                                |                                 Live Coding Sandbox                                |
| :----------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------: |
| ![Analytics Dashboard](https://via.placeholder.com/600x350?text=Analytics+Dashboard) | ![Live Monaco Editor](https://via.placeholder.com/600x350?text=Live+Monaco+Editor) |

|                                     Strict AI Proctoring                                     |                                AI Follow-up Discussion                               |
| :------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------: |
| ![Face & Phone Detection](https://via.placeholder.com/600x350?text=Face+%26+Phone+Detection) | ![AI Voice Discussion](https://via.placeholder.com/600x350?text=AI+Voice+Discussion) |

> Replace the placeholder images above with actual screenshots of the application before publishing the README.

---

# Live Demo

**Live Demo:** Add your deployed application URL here.

---

# Tech Stack

## Frontend

* React 19
* Vite
* Tailwind CSS v4
* Redux Toolkit
* Monaco Editor

## Backend

* Node.js
* Express.js
* MongoDB
* Mongoose

## AI & Machine Learning

* Groq API
* OpenAI API
* TensorFlow.js
* MediaPipe
* AI-based candidate evaluation
* AI-generated interview questions
* AI-powered coding evaluation
* Explainable scoring
* Skill-gap analysis

## Authentication & Services

* Firebase Authentication
* JWT Authentication

## Code Evaluation

* Monaco Editor
* Judge0
* RapidAPI

## Payment Gateway

* Razorpay

---

# Project Structure

```text
SmartHire_AI/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/              # Static assets and media
│   │   ├── components/          # Reusable UI components
│   │   ├── data/                # Mock data and constants
│   │   ├── pages/               # Application route pages
│   │   ├── redux/               # Redux slices and store
│   │   └── utils/               # Helper functions
│   │
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── backup/                  # Database backups
│   ├── config/                  # Database and service configuration
│   ├── controllers/             # Request handlers and business logic
│   ├── middlewares/             # Authentication and custom middleware
│   ├── models/                  # Mongoose database schemas
│   ├── routes/                  # API route definitions
│   ├── services/                # AI, payment and external API services
│   ├── utils/                   # Backend helper utilities
│   ├── index.js                 # Server entry point
│   └── package.json
│
└── README.md
```

---

# Installation

## Prerequisites

Make sure the following are installed:

* Node.js v18 or higher
* MongoDB or MongoDB Atlas
* Git
* Required API keys:

  * Groq API
  * RapidAPI / Judge0
  * Razorpay
  * Firebase
  * OpenAI (optional)

---

# Clone Repository

```bash
git clone https://github.com/sumitShahi255/SmartHire_AI.git
```

```bash
cd SmartHire_AI
```

---

# Client Setup

Navigate to the client directory:

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

# Server Setup

Open another terminal and navigate to the server directory:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Start the backend server:

```bash
npm run dev
```

Backend runs on:

```text
http://localhost:8000
```

---

# Environment Variables

Create a `.env` file inside both the `client` and `server` directories.

## Server `.env`

```env
PORT=8000
MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
groq_API_KEY=your_groq_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAPID_API_KEY=your_rapidapi_key
OPENAI_API_KEY=your_openai_api_key
```

### Server Environment Variables

| Variable              | Description                              | Required |
| --------------------- | ---------------------------------------- | :------: |
| `PORT`                | Backend API server port                  |    Yes   |
| `MONGODB_URL`         | MongoDB connection string                |    Yes   |
| `JWT_SECRET`          | Secret used for JWT authentication       |    Yes   |
| `groq_API_KEY`        | Groq API key for AI services             |    Yes   |
| `RAZORPAY_KEY_ID`     | Razorpay Key ID                          |    Yes   |
| `RAZORPAY_KEY_SECRET` | Razorpay secret                          |    Yes   |
| `RAPID_API_KEY`       | RapidAPI key for Judge0                  |    Yes   |
| `OPENAI_API_KEY`      | OpenAI API key used as optional fallback |    No    |

---

## Client `.env`

```env
VITE_FIREBASE_APIKEY=your_firebase_api_key
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### Client Environment Variables

| Variable               | Description                                  | Required |
| ---------------------- | -------------------------------------------- | :------: |
| `VITE_FIREBASE_APIKEY` | Firebase API key                             |    Yes   |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Key ID for client-side payment flow |    Yes   |

> **Security:** Never commit `.env` files or API keys to GitHub. Add `.env` to `.gitignore`.

---

# Quick Start

Start both the backend and frontend development servers.

### Start Backend

```bash
cd server
npm run dev
```

Backend:

```text
http://localhost:8000
```

### Start Frontend

```bash
cd client
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# Authentication

HireMind AI supports secure authentication through:

* Firebase Authentication
* JWT-based authentication
* Protected API routes
* Authentication middleware
* Google authentication through Firebase

---

# AI Resume Intelligence

The platform analyzes uploaded resumes to create a structured candidate profile.

The resume intelligence system can identify:

* Technical skills
* Work experience
* Projects
* Candidate competencies
* Skill gaps
* Relevant areas for interview assessment

The extracted information is then used to personalize the candidate's interview and evaluation process.

---

# Adaptive AI Interviews

HireMind AI provides dynamic AI-powered interviews where questions can evolve according to the candidate's previous responses.

The system supports:

* AI-generated interview questions
* HR interview rounds
* Technical interviews
* Adaptive follow-up questions
* Response analysis
* AI-generated evaluation
* Candidate-specific questioning

---

# Live Coding & DSA Evaluation

The platform provides an integrated coding environment using Monaco Editor.

Candidates can:

* Solve DSA problems
* Write code directly in the browser
* Execute code securely
* Receive execution results
* Submit solutions for evaluation
* Receive AI-powered coding feedback

Judge0 is used as the sandboxed code execution environment.

---

# AI Proctoring & Interview Monitoring

HireMind AI includes strict AI-powered proctoring features designed to monitor candidate activity during assessments.

### Monitoring Features

* Webcam monitoring
* Face tracking
* Face detection
* Phone/object detection
* Tab-switching detection
* Suspicious activity alerts
* Screen-focus monitoring
* AI-based proctoring

TensorFlow.js and MediaPipe are used for client-side computer vision and monitoring capabilities.

---

# Explainable Evaluation

Instead of providing only a final score, HireMind AI aims to explain the factors that contributed to a candidate's evaluation.

The evaluation system can provide:

* Overall candidate score
* Feature-level evaluation factors
* Question-wise performance
* Coding performance
* Interview performance
* Skill-based assessment
* Explainable scoring insights

SHAP/feature-factor-based analysis can be used to improve the transparency of evaluation results.

---

# Fairness Audit

HireMind AI includes post-hoc fairness auditing to help evaluate whether candidate assessments are being performed equitably.

The fairness layer is designed to:

* Analyze evaluation outcomes
* Identify potential disparities
* Support bias-aware evaluation
* Provide fairness-related insights
* Improve transparency in AI-assisted hiring

> AI-generated hiring assessments should support human decision-making rather than replace qualified human recruiters.

---

# Skill Gap Analysis

After evaluation, the system can identify missing or weak competencies.

Skill-gap analysis can highlight:

* Missing technical skills
* Weak coding concepts
* Communication gaps
* Areas requiring improvement
* Candidate strengths
* Recommended learning areas

---

# Personalized Skill Roadmap

Based on the candidate's evaluation and identified skill gaps, HireMind AI can generate a personalized development roadmap.

The roadmap can include:

1. Identified skill gaps
2. Recommended topics
3. Priority areas
4. Practical improvement steps
5. Suggested development direction

This allows candidates to understand not only **how they performed**, but also **how they can improve**.

---

# Candidate Evaluation Workflow

```text
Resume Upload
      ↓
Resume & Skill Extraction
      ↓
Candidate Profile Creation
      ↓
AI Interview / Coding Assessment
      ↓
AI Proctoring
      ↓
Response & Code Evaluation
      ↓
Evidence Collection
      ↓
Explainable Scoring
      ↓
Skill Gap Analysis
      ↓
Fairness Audit
      ↓
Recruiter Evaluation
      ↓
Personalized Candidate Roadmap
```

---

# Usage

### 1. Candidate Onboarding

Candidates register and upload their resumes.

The system extracts relevant candidate information and creates a personalized profile.

### 2. AI Interview

Candidates participate in AI-powered technical or HR interviews.

The system dynamically generates questions and follow-ups based on candidate responses.

### 3. Coding Assessment

Candidates solve DSA problems using the integrated Monaco Editor.

Code is executed through the Judge0 sandbox and evaluated for correctness and performance.

### 4. AI Proctoring

During interviews and coding assessments, the system monitors supported activities such as:

* Face presence
* Object/phone detection
* Tab switching
* Screen focus

### 5. Candidate Evaluation

The platform generates evaluation insights based on:

* Interview responses
* Coding performance
* Technical skills
* Communication
* Skill gaps
* Other supported evaluation factors

### 6. Development Roadmap

Candidates receive personalized improvement recommendations based on the identified skill gaps.

---

# API Documentation

The backend provides APIs for major platform modules.

| API Module              | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `/api/auth`             | Login, signup, Google authentication and JWT verification       |
| `/api/coding-interview` | Coding questions, Judge0 execution and AI grading               |
| `/api/interview`        | Interview handling, video processing and AI response evaluation |
| `/api/payment`          | Razorpay order creation and payment verification                |

---

# Payment Integration

Razorpay is integrated for secure payment processing.

The payment system supports:

* Razorpay order creation
* Payment processing
* Payment verification
* Premium platform functionality
* Secure test-mode transactions

---

# GitHub Setup

Initialize Git:

```bash
git init
```

Add project files:

```bash
git add .
```

Commit the project:

```bash
git commit -m "Initial commit"
```

Set the main branch:

```bash
git branch -M main
```

Add your GitHub repository:

```bash
git remote add origin YOUR_GITHUB_REPOSITORY_LINK
```

Push the project:

```bash
git push -u origin main
```

---

# Files Ignored from GitHub

The following files and directories should not be committed:

```text
node_modules/
.env
dist/
build/
```

Example `.gitignore`:

```gitignore
node_modules/
.env
dist/
build/
```

---

# Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/AmazingFeature
```

3. Commit your changes:

```bash
git commit -m "Add some AmazingFeature"
```

4. Push the branch:

```bash
git push origin feature/AmazingFeature
```

5. Open a Pull Request.

---

# Future Improvements

* Multi-language interviews
* Advanced AI resume optimization
* Company-specific interview preparation
* Advanced coding interview rounds
* More programming languages through Judge0
* Advanced fairness and bias metrics
* Improved explainable AI dashboards
* Recruiter analytics dashboard
* Candidate comparison tools
* Advanced skill recommendation engine
* Personalized learning resource recommendations

---

# Author

## Sumit Shahi

**Full Stack MERN Developer**

GitHub: https://github.com/sumitShahi255

---

# Support

If you find this project useful, consider giving the repository a ⭐ on GitHub.

---

# License

This project is currently intended for educational and portfolio purposes.

Add the appropriate license information here if you decide to publish the project under an open-source license.
