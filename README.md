# Data Desk

A CSV and Excel explorer built with React, TypeScript, Vite, Tailwind CSS, D3, Lucide icons and SheetJS.

## Features

- Upload one or more `.csv`, `.xlsx` or `.xls` files (drag and drop or file picker).
- Every CSV file or Excel worksheet becomes its own dataset.
- After upload, label each parsed sheet before adding it to the workspace.
- Sidebar groups uploaded files by dataset, with selection and removal.
- **Find relationships**: toggle the cable button in the sidebar, pick two datasets, and discover candidate foreign keys by matching distinct values across columns, with one-to-one, one-to-many and many-to-one cardinality hints. Accept a candidate to save it in the **Relations** tab, which renders a D3 node graph of saved dataset relations. Accepted foreign-key cells become clickable in the Data tab and jump to the matching row in the referenced sheet.
- Light/dark theme switcher, remembered in local storage and defaulting to the system preference.
- **Info** tab: row/column/cell counts, completeness, detected column types, value ranges, missing-value summary and a D3 bar chart of missing values.
- **Data** tab: paginated content viewer with global search, per-column filters, column sorting, page-size controls and CSV export.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL in your browser.

## Scripts

```bash
npm run dev      # start the Vite dev server
npm run build    # type-check and build for production
npm run lint     # run Oxlint
npm run preview  # preview the production build
```

## Stack

- React 19 + TypeScript
- Vite 8 + Tailwind CSS 4
- D3 (statistics, scales, axes and CSV formatting)
- Lucide React icons
- SheetJS (`xlsx`) for CSV/Excel parsing, loaded lazily on first upload
