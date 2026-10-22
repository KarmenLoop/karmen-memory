# Console design

The console presents a traceable memory workflow: contextual input, extracted candidate, scope and conflict review, confirmed fact, authorized retrieval, and use feedback.

## Pages

| Page | Primary task |
| --- | --- |
| Overview | Understand the memory library, priority tools, review queue, and recent use |
| Memory library | Inspect, search, correct, favorite, archive, and restore facts |
| Retrieval | See matches, reasons, sources, and proposed context |
| Agent access | Configure simulated per-tool access and connection states |
| LAN devices | Explore explicit sharing and device pairing states |
| Candidate review | Check evidence, accept or exclude facts, and resolve scope differences |
| Activity | Trace sample calls and actual prototype operations |
| Evaluation | Understand a comparison and the requirements for real measurements |
| Settings | Inspect storage, configuration intent, import/export, and sample reset |

## Koder-first hierarchy

Koder, Koder CLI, and Cursor appear first throughout the interface. Koder and Koder CLI have a KARMEN label; Cursor is identified as a priority editor. Other tools form a separate group. This order persists when a priority tool is paused.

The light gray-white and moss-green palette is shared across pages. Larger headings, readable secondary text, clear focus, and consistent spacing support frequent desktop use. Navigation folds into a drawer on narrow screens. Priority tool cards become one column; long tables scroll within their own container.

Dialogs use the native dialog element. Forms have visible labels, errors appear near the relevant operation, and writes produce status feedback. Reduced-motion preferences disable animation. These choices are not a complete accessibility certification.

![Narrow-screen overview](images/overview-mobile.png)
