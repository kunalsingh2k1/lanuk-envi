# Product requirements

What Envi is, who it is for and what it must do. Requirements marked **Met** are in the code today;
see [STATUS.md](STATUS.md) for how each was verified.

## 01 Overview

| | |
| --- | --- |
| Name | Envi |
| One line | One screen to talk to any of your AI models and see the state of Lanuk Office. |
| Owner and only user | Kunal Singh, solo founder of Lanuk Office |
| Runs on | Kunal's Windows PC, opened in a browser |

## 02 Problem

Kunal pays for Claude and ChatGPT and runs local models through Ollama. Each lives in its own app.
None of them knows the current state of his agency, so every conversation starts with him explaining
it again. The agency's facts are spread across Markdown files, a Supabase project and his head.

## 03 Goal

Kunal opens one page, picks a model and asks. The answer already knows the agents, client briefs,
money and launch date, and every exchange is saved where he can find it.

## 04 User

One person: Kunal. He works about 5 hours a day, switches between desktop and phone, writes in
English and Hinglish, and is not a full-time developer. No other accounts or roles are planned.

## 05 Core features

| # | Feature | State |
| --- | --- | --- |
| 1 | Chat with Claude, Codex or a local Ollama model from one box, streamed | Met |
| 2 | Switch model per message; use existing subscriptions, no API keys | Met |
| 3 | Answers grounded in live agency state read from the vault and Supabase | Met |
| 4 | Instant read-outs (status, next, money, briefs) that use no model | Met |
| 5 | Missions checklist that saves ticks | Met |
| 6 | Money and launch view | Met |
| 7 | Every exchange logged to the Obsidian vault and to Supabase | Met |
| 8 | Voice: speak a message, hear the reply, "Hi Envi" wake phrase | Built, not tested with a real voice |
| 9 | Works on a phone-sized screen with no page scrolling | Met |
| 10 | Runs 24/7 on the PC | Met at sign-in; not tested after a reboot |
| 11 | Reachable from anywhere at `envi.lanukx.in` behind a login | Not done |
| 12 | Message Envi on Telegram and WhatsApp through Hermes | Not done |
| 13 | Auto mode that picks the model | Placeholder only |

## 06 Out of scope for now

- Envi acting on its own: editing files, sending messages, running agents, changing client systems.
  Its models can talk, not act. This is a deliberate safety line, not a missing feature.
- Other users, sharing, billing.
- Being a general task runner. Missions are a checklist, not jobs.

## 07 Success measures

These are proposed, not yet agreed with Kunal:

- Kunal uses Envi instead of opening a model's own app for agency questions.
- A status question is answered correctly without him supplying context.
- Local models handle the routine questions, so paid plan limits last the month.

## 08 Constraints

- Tool budget is ₹5,000 to ₹15,000 a month in total; Envi itself must add no paid service.
- Claude and Codex run through their command-line tools on Kunal's logins, so each message counts
  against his plan limits.
- The PC has an RTX 3060 and 16 GB RAM; large local models are slow.
