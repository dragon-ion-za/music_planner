# Music Planner

A church/congregation music scheduling tool that helps planners manage song selections across services while avoiding repetition conflicts.

## Core Functionality

- Load a JSON schedule file containing service dates and song assignments
- Display services in a grid layout with song slots per service (orchestra, choir, congregation sections)
- Detect and highlight song conflicts based on recency:
  - **Conflict** (red): Same song used within ~56 days
  - **Quarter conflict** (yellow): Same song used within ~90 days
  - **Year conflict** (green): Same song used within ~365 days
- Translate song numbers between repertoire systems (e.g. "A10" → "E7")
- Add new service dates and save the updated schedule back to JSON

## Song Slot Types

Each service has 14 song slots: `orchestra1–5`, `choir1–4`, `congregationBS`, `congregationOH`, `congregationRP`, `congregationCM1`, `congregationCM2`

## Data

- Schedule data is loaded from a user-provided JSON file (not bundled)
- Repertoire/translation data lives in `src/assets/repertoire.json`
